import { FormFactor } from '../core/schema';

export const getDefaultForm = (): FormFactor => ({
  version: '2.0.0',
  metadata: {
    title: 'Formia 설문지',
    description: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  theme: {
    mode: 'light',
    tokens: {},
  },
  pages: {
    start: {
      id: 'start',
      type: 'start',
      title: '시작 페이지',
      description: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
      blocks: [
        {
          id: 'start-block-1',
          type: 'statement',
          content: {
            label: 'Formia 설문지',
            body: '앞으로 AI Agent가 당신의 설문을 만들어 드립니다.',
          },
          removable: true
        },
        {
          id: 'q1',
          type: 'text',
          content: {
            label: '이름을 입력해 주세요.',
            placeholder: '예: 홍길동'
          },
          validation: { required: true },
          removable: true
        },
        {
          id: 'q2',
          type: 'choice',
          content: {
            label: '신청 경로를 선택해 주세요.',
            options: ['지인 추천', 'SNS 광고', '검색 엔진', '기타']
          },
          removable: true
        }
      ],
      removable: false
    },
    questions: [],
    endings: [
      {
        id: 'end',
        type: 'ending',
        title: '완료 페이지',
        blocks: [
          {
            id: 'end-block-1',
            type: 'statement',
            content: {
              label: '신청이 완료되었습니다.',
              body: '빠른 시일 내에 확인 후 연락드리겠습니다. 감사합니다!'
            },
            removable: true
          }
        ],
        removable: true
      }
    ]
  }
});
