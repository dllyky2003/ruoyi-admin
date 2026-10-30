import type { RouteRecordRaw } from 'vue-router';

const emsRoutes: RouteRecordRaw[] = [
  {
    path: '/emergency',
    name: 'Emergency',
    redirect: '/emergency/exam',
    meta: {
      title: '院前急救',
      icon: 'monitor',
      order: 5,
    },
    children: [
      {
        path: 'exam',
        name: 'EmsExam',
        component: () => import('../../views/emergency/Exam.vue'),
        meta: {
          title: '急救考核',
          icon: 'aim',
          keepAlive: false,
        },
      },
      {
        path: 'report/:sessionId',
        name: 'EmsReport',
        component: () => import('../../views/emergency/Report.vue'),
        meta: {
          title: '考核报告',
          icon: 'document',
          hidden: true,
          keepAlive: false,
        },
      },
      {
        path: 'history',
        name: 'EmsHistory',
        component: () => import('../../views/emergency/History.vue'),
        meta: {
          title: '历史记录',
          icon: 'list',
          keepAlive: true,
        },
      },
    ],
  },
];

export default emsRoutes;
