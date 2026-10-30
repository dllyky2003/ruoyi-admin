import type { RouteRecordRaw } from 'vue-router';

const BasicLayout = () => import('#/layouts/basic.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/workflow-management',
    name: 'WorkflowManagement',
    component: BasicLayout,
    redirect: '/workflow-management/designer',
    meta: {
      title: '工作流管理',
      icon: 'lucide:workflow',
      order: 20,
    },
    children: [
      {
        path: 'designer',
        name: 'WorkflowDesigner',
        component: () =>
          import(
            '#/views/emergency/libraryItemVersion/workflow-designer/index.vue'
            ),
        meta: {
          title: '工作流设计器',
          icon: 'lucide:workflow',
          keepAlive: false,
        },
      },
    ],
  },
];

export default routes;