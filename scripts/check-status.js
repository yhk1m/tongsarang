import { readFileSync, existsSync } from 'fs';

const subjects = ['한국지리','세계지리','통합사회','정치와법','경제','사회문화','생활과윤리','윤리와사상'];

for (const s of subjects) {
  const path = `public/data/${s}.json`;
  if (!existsSync(path)) { console.log(`${s}: 파일 없음`); continue; }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const total = data.length;
  const wb = data.filter(d => d.발문).length;
  const wc = data.filter(d => d.문항내용).length;
  const ws = data.filter(d => d.성취기준 && !/^\d+-\d+\./.test(d.성취기준)).length;
  console.log(`${s}: 총 ${total} | 발문 ${wb} | 문항내용 ${wc} | 성취기준 ${ws}`);
}
