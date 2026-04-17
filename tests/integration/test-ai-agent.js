// Use native global fetch

const API_URL = 'http://localhost:3001/api/ai/generate';

const defaultSchema = {
  version: '2.0.0',
  metadata: { title: '테스트 설문', description: '테스트용' },
  theme: { mode: 'light', tokens: {} },
  pages: {
    start: { id: 'start', type: 'start', title: '시작', blocks: [] },
    questions: [],
    endings: [{ id: 'end', type: 'ending', title: '종료', blocks: [] }]
  }
};

async function testPrompt(prompt) {
  console.log(`\n🚀 Testing Prompt: "${prompt}"`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        currentSchema: defaultSchema,
        provider: 'gemini'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ API Error (${response.status}):`, data);
      return false;
    }

    console.log('✅ Status: OK');
    console.log('🧠 Reasoning:', data.reasoning);
    console.log('📝 Summary:', data.summary);
    console.log('🛠️ Patches Count:', data.patches.length);
    
    // Check if any patch has invalid content
    const invalidPatches = data.patches.filter(p => {
      if (p.op !== 'add') return false;
      const v = p.value;
      if (!v) return true;
      
      // If it looks like a block
      if (v.type && ['text', 'textarea', 'choice', 'rating', 'date', 'file', 'info', 'statement'].includes(v.type)) {
        return typeof v.content !== 'object' || !v.content.label;
      }
      
      // If it looks like a page
      if (v.type && ['default', 'start', 'ending'].includes(v.type)) {
        return !v.title || !Array.isArray(v.blocks);
      }
      
      return false;
    });

    if (invalidPatches.length > 0) {
      console.error('❌ Validation Error: Some patches have invalid "content" structure!');
      console.log(JSON.stringify(invalidPatches, null, 2));
      return false;
    }

    console.log('✨ All good for this prompt!');
    return true;
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    return false;
  }
}

async function runAllTests() {
  const prompts = [
    "강아지 행사 참가 신청 폼으로 만들어줘",
    "이메일과 전화번호를 입력받는 문항을 시작 페이지에 추가해줘",
    "설문 만족도를 5점 만점으로 평가하는 별점 문항을 새로 추가해줘",
    "설문지 제목을 '2024 반려견 축제 신청'으로 바꿔줘"
  ];

  for (const p of prompts) {
    await testPrompt(p);
  }
}

runAllTests();
