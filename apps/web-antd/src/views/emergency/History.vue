<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  downloadBlob,
  getReportFilename,
  reportApi,
} from '../../api/ems/report.api';
// ===== 导入 =====
import { useEmsStore } from '../../store/modules/ems';

// ===== Router =====
const router = useRouter();

// ===== Store =====
const store = useEmsStore();

// ===== 类型定义 =====
interface HistoryItem {
  id: string;
  sessionId: string;
  traineeName: string;
  scenarioId: string;
  scenarioName: string;
  mode: 'EXAM' | 'TEACH';
  totalScore: number;
  isPass: boolean;
  startTime: string;
  endTime?: string;
  duration: number; // 秒
  criticalErrors: string[];
}

// ===== 状态 =====
const loading = ref(false);
const tableData = ref<HistoryItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

// ===== 搜索表单 =====
const searchForm = reactive({
  traineeName: '',
  mode: '' as '' | 'EXAM' | 'TEACH',
  result: '' as '' | 'FAIL' | 'PASS',
  dateRange: [] as string[],
  sortField: '',
  sortOrder: '' as '' | 'asc' | 'desc',
});

// ===== 删除状态 =====
const showDeleteDialog = ref(false);
const deleteLoading = ref(false);
const deleteTarget = ref<HistoryItem | null>(null);

// ===== 场景名称映射 =====
const scenarioNameMap = new Map<string, string>([
  ['SCE-2025-002', '不稳定心动过速（低血压）'],
  ['SCE-2025-003', '宽QRS不规则心动过速'],
  ['SCE-2025-004', 'WPW综合征伴房颤'],
  ['stable_narrow', '稳定窄QRS心动过速'],
]);

// ===== 方法 =====

/**
 * 加载历史数据
 */
const loadHistory = async () => {
  loading.value = true;
  try {
    // 构建请求参数
    const params = {
      page: currentPage.value,
      size: pageSize.value,
      traineeName: searchForm.traineeName || undefined,
      mode: searchForm.mode || undefined,
      result: searchForm.result || undefined,
      startDate: searchForm.dateRange?.[0] || undefined,
      endDate: searchForm.dateRange?.[1] || undefined,
      sortField: searchForm.sortField || undefined,
      sortOrder: searchForm.sortOrder || undefined,
    };

    // 调用后端 API（如果已实现）
    // const result = await historyApi.list(params);
    // tableData.value = result.data.items;
    // total.value = result.data.total;

    // ===== 模拟数据（开发阶段使用） =====
    await new Promise((resolve) => setTimeout(resolve, 500));
    const mockData: HistoryItem[] = [
      {
        id: '1',
        sessionId: 'SESSION-001',
        traineeName: '张三',
        scenarioId: 'stable_narrow',
        scenarioName: '稳定窄QRS心动过速',
        mode: 'EXAM',
        totalScore: 85,
        isPass: true,
        startTime: '2026-08-23 10:30:00',
        endTime: '2026-08-23 10:35:00',
        duration: 300,
        criticalErrors: [],
      },
      {
        id: '2',
        sessionId: 'SESSION-002',
        traineeName: '李四',
        scenarioId: 'SCE-2025-002',
        scenarioName: '不稳定心动过速（低血压）',
        mode: 'TEACH',
        totalScore: 62,
        isPass: false,
        startTime: '2026-08-23 09:15:00',
        endTime: '2026-08-23 09:22:00',
        duration: 420,
        criticalErrors: ['未识别不稳定体征', '未执行同步电复律'],
      },
      {
        id: '3',
        sessionId: 'SESSION-003',
        traineeName: '王五',
        scenarioId: 'stable_narrow',
        scenarioName: '稳定窄QRS心动过速',
        mode: 'EXAM',
        totalScore: 92,
        isPass: true,
        startTime: '2026-08-22 14:00:00',
        endTime: '2026-08-22 14:04:00',
        duration: 240,
        criticalErrors: [],
      },
      {
        id: '4',
        sessionId: 'SESSION-004',
        traineeName: '赵六',
        scenarioId: 'SCE-2025-003',
        scenarioName: '宽QRS不规则心动过速',
        mode: 'EXAM',
        totalScore: 55,
        isPass: false,
        startTime: '2026-08-22 11:20:00',
        endTime: '2026-08-22 11:28:00',
        duration: 480,
        criticalErrors: ['未识别多形性VT', '未正确使用除颤'],
      },
      {
        id: '5',
        sessionId: 'SESSION-005',
        traineeName: '钱七',
        scenarioId: 'stable_narrow',
        scenarioName: '稳定窄QRS心动过速',
        mode: 'TEACH',
        totalScore: 78,
        isPass: true,
        startTime: '2026-08-21 16:30:00',
        endTime: '2026-08-21 16:36:00',
        duration: 360,
        criticalErrors: [],
      },
    ];

    // 分页模拟
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    tableData.value = mockData.slice(start, end);
    total.value = mockData.length;
    // ===== 模拟数据结束 =====
  } catch (error) {
    console.error('[History] 加载失败:', error);
    console.error('加载历史记录失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 搜索
 */
const handleSearch = () => {
  currentPage.value = 1;
  loadHistory();
};

/**
 * 重置搜索
 */
const handleResetSearch = () => {
  searchForm.traineeName = '';
  searchForm.mode = '';
  searchForm.result = '';
  searchForm.dateRange = [];
  searchForm.sortField = '';
  searchForm.sortOrder = '';
  currentPage.value = 1;
  loadHistory();
};

/**
 * 刷新
 */
const handleRefresh = () => {
  loadHistory();
};

/**
 * 分页变化
 */
const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadHistory();
};

/**
 * 每页条数变化
 */
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadHistory();
};

/**
 * 排序变化
 */
const handleSortChange = ({
  prop,
  order,
}: {
  order: null | string;
  prop: string;
}) => {
  searchForm.sortField = prop || '';
  searchForm.sortOrder =
    order === 'ascending' ? 'asc' : (order === 'descending' ? 'desc' : '');
  currentPage.value = 1;
  loadHistory();
};

/**
 * 查看报告
 */
const handleViewReport = (row: HistoryItem) => {
  router.push(`/emergency/report/${row.sessionId}`);
};

/**
 * 导出报告
 */
const handleExport = async (row: HistoryItem) => {
  try {
    const blob = await reportApi.exportMarkdown(row.sessionId);
    const filename = getReportFilename(row.sessionId, 'md');
    downloadBlob(blob, filename);
    console.log('📥 导出成功');
  } catch {
    console.error('导出失败');
  }
};

/**
 * 删除记录
 */
const handleDelete = (row: HistoryItem) => {
  deleteTarget.value = row;
  showDeleteDialog.value = true;
};

/**
 * 确认删除
 */
const confirmDelete = async () => {
  if (!deleteTarget.value) return;

  deleteLoading.value = true;
  try {
    // 调用后端 API
    // await historyApi.delete(deleteTarget.value.id);

    // 模拟删除
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('✅ 删除成功');
    showDeleteDialog.value = false;
    deleteTarget.value = null;
    // 刷新列表
    loadHistory();
  } catch {
    console.error('删除失败');
  } finally {
    deleteLoading.value = false;
  }
};

/**
 * 新建考核
 */
const handleGoExam = () => {
  router.push('/emergency/exam');
};

// ===== 工具函数 =====

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 1) return `${secs}秒`;
  if (mins < 60) return `${mins}分${secs}秒`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}小时${remainMins}分${secs}秒`;
};

// ===== 生命周期 =====

onMounted(() => {
  loadHistory();
});
</script>

<template>
  <div class="ems-history">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <h2>📋 考核历史记录</h2>
        <el-tag type="info" size="large">共 {{ total }} 条记录</el-tag>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="handleRefresh">
          <el-icon>
            <Refresh />
          </el-icon>
          刷新
        </el-button>
        <el-button @click="handleGoExam">
          <el-icon>
            <Plus />
          </el-icon>
          新建考核
        </el-button>
      </div>
    </div>

    <!-- 搜索筛选 -->
    <el-card class="search-card" shadow="hover">
      <el-form :model="searchForm" inline size="default">
        <el-form-item label="学员姓名">
          <el-input
            v-model="searchForm.traineeName"
            placeholder="请输入学员姓名"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="考核模式">
          <el-select
            v-model="searchForm.mode"
            placeholder="全部"
            clearable
            style="width: 130px"
          >
            <el-option label="考核" value="EXAM" />
            <el-option label="教学" value="TEACH" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select
            v-model="searchForm.result"
            placeholder="全部"
            clearable
            style="width: 130px"
          >
            <el-option label="✅ 通过" value="PASS" />
            <el-option label="❌ 不通过" value="FAIL" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleResetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card" shadow="hover">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
        @sort-change="handleSortChange"
      >
        <el-table-column prop="index" label="#" width="60" align="center" fixed>
          <template #default="{ $index }">
            {{ (currentPage - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>

        <el-table-column
          prop="traineeName"
          label="学员姓名"
          min-width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-text>{{ row.traineeName || '未命名' }}</el-text>
          </template>
        </el-table-column>

        <el-table-column
          prop="scenarioName"
          label="考核场景"
          min-width="160"
          sortable="custom"
        />

        <el-table-column prop="mode" label="模式" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.mode === 'TEACH' ? 'info' : 'primary'"
              size="small"
            >
              {{ row.mode === 'TEACH' ? '📖 教学' : '📝 考核' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="totalScore"
          label="总分"
          width="100"
          align="center"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-text
              :type="row.totalScore >= 70 ? 'success' : 'danger'"
              size="large"
              style="font-weight: bold"
            >
              {{ row.totalScore || '--' }}
            </el-text>
          </template>
        </el-table-column>

        <el-table-column prop="isPass" label="结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isPass ? 'success' : 'danger'" size="small">
              {{ row.isPass ? '✅ 通过' : '❌ 不通过' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="startTime"
          label="考核时间"
          width="180"
          align="center"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.startTime) }}
          </template>
        </el-table-column>

        <el-table-column
          prop="duration"
          label="用时"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="handleViewReport(row)"
            >
              📄 报告
            </el-button>
            <el-button
              type="success"
              link
              size="small"
              @click="handleExport(row)"
            >
              📥 导出
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- ====== 确认删除对话框 ====== -->
    <el-dialog v-model="showDeleteDialog" title="⚠️ 确认删除" width="420px">
      <p>确认删除该条考核记录吗？</p>
      <p style="color: #f56c6c; font-size: 14px">删除后数据将无法恢复！</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">取消</el-button>
        <el-button
          type="danger"
          :loading="deleteLoading"
          @click="confirmDelete"
        >
          确认删除
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ems-history {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 22px;
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.search-card {
  margin-bottom: 16px;

  :deep(.el-card__body) {
    padding: 16px 20px;
  }

  .el-form-item {
    margin-bottom: 8px;
  }
}

.table-card {
  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e4e7ed;
  }
}

// 响应式
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .search-card :deep(.el-form-item) {
    width: 100%;
  }
}
</style>
