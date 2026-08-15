# 통사랑 Supabase 마이그레이션 계획

## 목표

현재 브라우저 localStorage에 저장되는 수정사항(EditStore, LinkerStore)을 Supabase DB로 이전하여 영구적·누적적 데이터 관리 실현

---

## 현재 구조 (AS-IS)

| 저장소 | 데이터 | 키 |
|--------|--------|-----|
| localStorage (`tongsarang_field_edits`) | 발문, 문항내용, 배점, 답 수정 | `{과목}.{학년도_분류_번호}.{필드}` |
| localStorage (`tongsarang_achievement_mappings`) | 성취기준 매핑 | `{과목}.{학년도_분류_번호}` |
| `public/data/default_mappings.json` | 성취기준 기본 매핑 (정적) | 동일 |

### 문제점
- 브라우저/기기 종속 (캐시 삭제 시 유실)
- 다른 기기에서 작업 불가
- 수정사항 공유 불가 (관리자 간)
- 일반 사용자에게 수정 결과 미반영 (본인 브라우저에만 적용)

---

## 목표 구조 (TO-BE)

| 저장소 | 데이터 |
|--------|--------|
| Supabase `question_edits` 테이블 | 발문, 문항내용, 배점, 답 수정 |
| Supabase `achievement_mappings` 테이블 | 성취기준 매핑 |
| (삭제) `default_mappings.json` | Supabase로 통합 |
| (삭제) localStorage | 불필요 |

### 이점
- 어떤 브라우저/기기에서든 수정사항 즉시 반영
- 관리자가 수정하면 일반 사용자에게도 반영
- 데이터 유실 없음

---

## 1단계: Supabase 프로젝트 설정

### 1-1. 프로젝트 생성
- 기존 e-GIS Supabase 프로젝트에 테이블 추가 또는 새 프로젝트 생성
- 새 프로젝트 권장 (프로젝트 분리)

### 1-2. 테이블 생성

```sql
-- 문항 수정 테이블
CREATE TABLE question_edits (
  id          BIGSERIAL PRIMARY KEY,
  subject     TEXT NOT NULL,           -- '한국지리', '세계지리' 등
  question_key TEXT NOT NULL,          -- '2025_수능_1'
  field       TEXT NOT NULL,           -- '답', '배점', '발문', '문항내용'
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject, question_key, field)
);

-- 성취기준 매핑 테이블
CREATE TABLE achievement_mappings (
  id           BIGSERIAL PRIMARY KEY,
  subject      TEXT NOT NULL,
  question_key TEXT NOT NULL,          -- '2025_수능_1'
  standard_id  TEXT NOT NULL,          -- '[10통사1-04-02]'
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject, question_key)
);

-- 인덱스
CREATE INDEX idx_edits_subject ON question_edits(subject);
CREATE INDEX idx_mappings_subject ON achievement_mappings(subject);
```

### 1-3. RLS (Row Level Security) 정책

```sql
-- question_edits
ALTER TABLE question_edits ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (일반 사용자도 수정사항 반영)
CREATE POLICY "read_all" ON question_edits FOR SELECT USING (true);

-- 쓰기는 anon key + 관리자 비밀번호로 앱 레벨에서 제어
-- (또는 service_role key를 관리자 모드에서만 사용)
CREATE POLICY "write_all" ON question_edits FOR ALL USING (true);

-- achievement_mappings 동일
ALTER TABLE achievement_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON achievement_mappings FOR SELECT USING (true);
CREATE POLICY "write_all" ON achievement_mappings FOR ALL USING (true);
```

> 참고: 통사랑은 관리자만 수정하고, 관리자 모드 진입 자체가 비밀번호로 보호되므로 RLS는 전체 허용으로 설정해도 무방

---

## 2단계: 프론트엔드 Supabase 연동

### 2-1. Supabase 클라이언트 설치

```bash
npm install @supabase/supabase-js
```

### 2-2. Supabase 클라이언트 초기화

```javascript
// src/core/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 2-3. EditStore 리팩토링

```
AS-IS: EditStore → localStorage 읽기/쓰기
TO-BE: EditStore → Supabase 읽기/쓰기 (캐시용 메모리 유지)
```

주요 변경:
- `constructor()`: Supabase에서 전체 수정사항 로드 → 메모리 캐시
- `setEdit()`: Supabase UPSERT + 메모리 캐시 갱신
- `removeEdit()`: Supabase DELETE + 메모리 캐시 갱신
- `getEdit()`, `getFieldValue()`: 메모리 캐시에서 읽기 (변경 없음)
- `exportJSON()`, `importJSON()`: 유지 (백업 용도) 또는 제거

```javascript
// src/core/EditStore.js (리팩토링 후)
import { supabase } from './supabase.js';

export class EditStore {
  constructor() {
    this.data = {};
    this.loaded = false;
  }

  async load() {
    const { data, error } = await supabase
      .from('question_edits')
      .select('subject, question_key, field, value');

    if (error) { console.error(error); return; }

    this.data = {};
    for (const row of data) {
      if (!this.data[row.subject]) this.data[row.subject] = {};
      if (!this.data[row.subject][row.question_key]) this.data[row.subject][row.question_key] = {};
      this.data[row.subject][row.question_key][row.field] = row.value;
    }
    this.loaded = true;
  }

  async setEdit(subject, item, field, value) {
    const key = this.questionKey(item);
    // 메모리 캐시 갱신
    if (!this.data[subject]) this.data[subject] = {};
    if (!this.data[subject][key]) this.data[subject][key] = {};
    this.data[subject][key][field] = value;

    // Supabase UPSERT
    await supabase.from('question_edits').upsert({
      subject, question_key: key, field, value
    }, { onConflict: 'subject,question_key,field' });
  }

  async removeEdit(subject, item, field) {
    const key = this.questionKey(item);
    // 메모리 캐시 삭제
    if (this.data[subject]?.[key]) {
      delete this.data[subject][key][field];
    }

    // Supabase DELETE
    await supabase.from('question_edits')
      .delete()
      .eq('subject', subject)
      .eq('question_key', key)
      .eq('field', field);
  }

  // getEdit, getFieldValue, hasEdit 등은 기존과 동일 (메모리에서 읽기)
}
```

### 2-4. LinkerStore 리팩토링

```javascript
// src/core/LinkerStore.js (리팩토링 후)
import { supabase } from './supabase.js';

export class LinkerStore {
  constructor() {
    this.data = {};
  }

  async load() {
    const { data, error } = await supabase
      .from('achievement_mappings')
      .select('subject, question_key, standard_id');

    if (error) { console.error(error); return; }

    this.data = {};
    for (const row of data) {
      if (!this.data[row.subject]) this.data[row.subject] = {};
      this.data[row.subject][row.question_key] = row.standard_id;
    }
  }

  async setMapping(subject, item, standardId) {
    const key = this.questionKey(item);
    if (!this.data[subject]) this.data[subject] = {};
    this.data[subject][key] = standardId;

    await supabase.from('achievement_mappings').upsert({
      subject, question_key: key, standard_id: standardId
    }, { onConflict: 'subject,question_key' });
  }

  // getMapping 등은 기존과 동일 (메모리에서 읽기)
}
```

### 2-5. App.js 초기화 수정

```javascript
async init() {
  this._checkAdminMode();
  this.render();
  this.bindEvents();

  // Supabase에서 데이터 로드 (기존 loadDefaults 대체)
  await Promise.all([
    this.editStore.load(),
    this.linkerStore.load()
  ]);

  await this.loadSubject(this.currentSubject);
  trackVisit();
}
```

---

## 3단계: 기존 데이터 마이그레이션

### 3-1. default_mappings.json → Supabase

```javascript
// 1회성 마이그레이션 스크립트
import mappings from './public/data/default_mappings.json';

for (const [subject, items] of Object.entries(mappings)) {
  for (const [key, standardId] of Object.entries(items)) {
    await supabase.from('achievement_mappings').upsert({
      subject, question_key: key, standard_id: standardId
    }, { onConflict: 'subject,question_key' });
  }
}
```

### 3-2. localStorage 수정사항 → Supabase (선택)
- 관리자 브라우저에 남아 있는 localStorage 데이터가 있으면 1회 마이그레이션
- 내보내기 JSON 파일이 있으면 그것을 import

---

## 4단계: 정리

- [ ] `default_mappings.json` 삭제 (Supabase로 이전 완료 후)
- [ ] `LinkerStore.loadDefaults()` 메서드 제거
- [ ] localStorage 관련 코드 제거
- [ ] DevToolbar 내보내기/가져오기 버튼 제거 (또는 백업용으로 유지)

---

## 작업 순서 요약

| 순서 | 작업 | 예상 소요 |
|------|------|-----------|
| 1 | Supabase 프로젝트 + 테이블 생성 | 10분 |
| 2 | `@supabase/supabase-js` 설치 + 클라이언트 초기화 | 5분 |
| 3 | EditStore Supabase 연동 | 20분 |
| 4 | LinkerStore Supabase 연동 | 15분 |
| 5 | App.js 초기화 수정 | 5분 |
| 6 | default_mappings.json 데이터 마이그레이션 | 10분 |
| 7 | localStorage/내보내기 코드 정리 | 5분 |
| 8 | 테스트 + 배포 | 10분 |

---

## 참고: 환경 변수

Supabase URL/Key는 정적 사이트이므로 소스에 직접 포함 (anon key는 클라이언트용으로 노출 가능).
보안은 RLS 정책으로 제어.
