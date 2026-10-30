<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
    downloadBlob,
    getReportFilename,
    reportApi,
} from '../../api/ems/report.api';
import { useEvaluation } from '../../composables/ems/useEvaluation';
// ===== 导入 =====
import { useEmsStore } from '../../store/modules/ems';

// ===== Router =====
const router = useRouter();
const route = useRoute();

// ===== Store =====
const store = useEmsStore();

// ===== Composables =====
const {
    evaluation,
    isLoading: evalLoading,
    getResult,
    getAgentTrace,
} = useEvaluation();

// ===== 状态 =====
const loading = ref(true);
const transcript = ref('');
const transcriptWordCount = ref(0);
const agentTrace = ref<null | Record<string, any>>(null);
const showFullReport = ref(true);
const showAgentTrace = ref(false);
const showTranscript = ref(false);

// ===== 计算属性 =====
const sessionId = computed(() => route.params.sessionId as string);
const session = computed(() => store.session);

const scoreLevelClass = computed(() => {
    if (!evaluation.value) return '';
    const score = evaluation.value.totalScore;
    if (score >= 90) return 'level-excellent';
    if (score >= 80) return 'level-good';
    if (score >= 70) return 'level-average';
    if (score >= 60) return 'level-poor';
    return 'level-fail';
});

const scoreLevelText = computed(() => {
    if (!evaluation.value) return '';
    const score = evaluation.value.totalScore;
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '不及格';
});

const formattedReport = computed(() => {
    if (!evaluation.value?.reportText) return '暂无评语';
    // 将换行符转换为 <br>
    return evaluation.value.reportText.replaceAll('\n', '<br>');
});

// ===== 映射 =====
const dimensionLabelMap: Record<string, string> = {
    assessmentAccuracy: '评估准确性',
    treatmentSequence: '治疗顺序',
    drugDosage: '药物剂量',
    communication: '沟通质量',
};

const difficultyMap: Record<string, string> = {
    BASIC: '基础',
    INTERMEDIATE: '中级',
    ADVANCED: '高级',
    EXPERT: '专家',
};

// ===== 方法 =====

const getScenarioName = (id?: string): string => {
    if (!id) return '未知';
    // 从 store 获取场景名称
    const s = store.scenarios.find((sc) => sc.id === id);
    return s ? s.name : id;
};

const getGuideVersion = (): string => {
    // 从场景配置获取指南版本
    const s = store.scenarios.find((sc) => sc.id === session.value?.scenarioId);
    return s?.guideVersion || 'AHA-2025';
};

const getDuration = (): number => {
    const start = session.value?.startTime;
    const end = session.value?.endTime;
    if (!start || !end) return 0;
    return (new Date(end).getTime() - new Date(start).getTime()) / 1000;
};

const formatDateTime = (dateStr?: string): string => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.floor(seconds)}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins < 60) return `${mins}分${secs}秒`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}小时${remainMins}分${secs}秒`;
};

const getProgressColor = (score: number): string => {
    if (score >= 80) return '#67c23a';
    if (score >= 60) return '#e6a23c';
    return '#f56c6c';
};

const handleBack = () => {
    router.push('/emergency/exam');
};

// ===== 导出方法 =====

const handleExportMarkdown = async () => {
    if (!sessionId.value) return;
    try {
        const blob = await reportApi.exportMarkdown(sessionId.value);
        downloadBlob(blob, getReportFilename(sessionId.value, 'md'));
        console.log('📥 导出成功');
    } catch {
        console.error('导出失败');
    }
};

const handleExportTxt = async () => {
    if (!sessionId.value) return;
    try {
        const blob = await reportApi.exportTxt(sessionId.value);
        downloadBlob(blob, getReportFilename(sessionId.value, 'txt'));
        console.log('📥 导出成功');
    } catch {
        console.error('导出失败');
    }
};

const handleExportPdf = async () => {
    if (!sessionId.value) return;
    try {
        const blob = await reportApi.exportPdf(sessionId.value);
        downloadBlob(blob, getReportFilename(sessionId.value, 'pdf'));
        console.log('📥 导出成功');
    } catch {
        console.error('导出 PDF 功能暂未支持，请使用 Markdown 或 TXT 格式');
    }
};

// ===== 加载数据 =====

onMounted(async () => {
    loading.value = true;
    try {
        const sid = sessionId.value;
        if (!sid) {
            console.warn('缺少会话ID');
            loading.value = false;
            return;
        }

        // 1. 获取评估结果
        const result = await getResult(sid);
        if (!result) {
            // 尝试重新触发评估
            console.info('评估结果尚未生成，请先完成考核');
            loading.value = false;
            return;
        }

        // 2. 获取转写文本
        // 如果 store 中有转写文本则直接使用，否则从 API 获取
        if (store.transcript) {
            transcript.value = store.transcript;
        } else {
            try {
                const transcriptResult = await reportApi.getDetail(sid);
                if (transcriptResult) {
                    transcript.value = transcriptResult.data || '';
                }
            } catch {
                // 转写获取失败不影响主流程
            }
        }

        // 3. 计算转写字数
        transcriptWordCount.value = transcript.value
            ? transcript.value.trim().split(/\s+/).length
            : 0;

        // 4. 获取智能体轨迹
        try {
            const trace = await getAgentTrace(sid);
            if (trace) {
                agentTrace.value = trace;
                // 有智能体轨迹时默认展开
                showAgentTrace.value = true;
            }
        } catch {
            // 智能体轨迹获取失败不影响主流程
        }
    } catch (error) {
        console.error('[Report] 加载失败:', error);
        console.error('加载报告失败');
    } finally {
        loading.value = false;
    }
});

// ===== 生命周期 =====
onUnmounted(() => {
    // 清理
});
</script>

<template>
    <div class="ems-report">
        <!-- 页面标题 -->
        <div class="page-header">
            <div class="header-left">
                <el-button text @click="handleBack">
                    <el-icon>
                        <ArrowLeft />
                    </el-icon>
                    返回
                </el-button>
                <h2>📄 考核报告</h2>
                <el-tag v-if="evaluation" :type="evaluation.isPass ? 'success' : 'danger'" size="large">
                    {{ evaluation.isPass ? '✅ 通过' : '❌ 不通过' }}
                </el-tag>
            </div>
            <div class="header-right">
                <el-button type="primary" plain @click="handleExportMarkdown">
                    📥 导出 Markdown
                </el-button>
                <el-button type="success" plain @click="handleExportTxt">
                    📥 导出 TXT
                </el-button>
                <el-button v-if="evaluation" type="warning" plain @click="handleExportPdf">
                    📥 导出 PDF
                </el-button>
            </div>
        </div>

        <!-- ====== 加载中 ====== -->
        <div v-if="loading" class="loading-container">
            <el-skeleton :rows="10" animated />
        </div>

        <!-- ====== 报告内容 ====== -->
        <template v-else-if="evaluation">
            <!-- 基本信息 -->
            <el-card class="info-card" shadow="hover">
                <template #header>
                    <span class="card-title">📋 基本信息</span>
                </template>
                <el-descriptions :column="3" border>
                    <el-descriptions-item label="会话ID">
                        <el-text size="small" type="info">{{ sessionId }}</el-text>
                    </el-descriptions-item>
                    <el-descriptions-item label="学员姓名">
                        {{ session?.traineeName || '未知' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="考核模式">
                        <el-tag :type="session?.mode === 'TEACH' ? 'info' : 'primary'" size="small">
                            {{ session?.mode === 'TEACH' ? '📖 教学' : '📝 考核' }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="考核场景">
                        {{ getScenarioName(session?.scenarioId) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="开始时间">
                        {{ formatDateTime(session?.startTime) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="结束时间">
                        {{ formatDateTime(session?.endTime) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="总用时">
                        {{ formatDuration(getDuration()) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="指南版本">
                        {{ getGuideVersion() }}
                    </el-descriptions-item>
                    <el-descriptions-item label="转写字数">
                        {{ transcriptWordCount }} 字
                    </el-descriptions-item>
                </el-descriptions>
            </el-card>

            <!-- 评分总览 -->
            <el-card class="score-card" shadow="hover">
                <template #header>
                    <span class="card-title">📊 评分总览</span>
                </template>
                <el-row :gutter="24">
                    <el-col :span="6">
                        <div class="score-display" :class="scoreLevelClass">
                            <div class="score-number">{{ evaluation.totalScore }}</div>
                            <div class="score-label">总分</div>
                            <div class="score-level">{{ scoreLevelText }}</div>
                        </div>
                    </el-col>
                    <el-col :span="18">
                        <el-row :gutter="16">
                            <el-col v-for="(score, key) in evaluation.dimensionScores" :key="key" :span="8">
                                <div class="dimension-score">
                                    <div class="dimension-label">
                                        {{ dimensionLabelMap[key] || key }}
                                    </div>
                                    <el-progress :percentage="score" :color="getProgressColor(score)"
                                        :stroke-width="12" />
                                    <div class="dimension-value">{{ score }}分</div>
                                </div>
                            </el-col>
                        </el-row>
                    </el-col>
                </el-row>
            </el-card>

            <!-- 错误与警告 -->
            <el-row :gutter="16">
                <el-col :span="12">
                    <el-card class="error-card" shadow="hover">
                        <template #header>
                            <span class="card-title" style="color: #f56c6c">❌ 致命错误</span>
                        </template>
                        <div v-if="evaluation.criticalErrors?.length" class="error-list">
                            <el-tag v-for="(err, i) in evaluation.criticalErrors" :key="i" type="danger" size="large"
                                style="margin: 4px">
                                {{ err }}
                            </el-tag>
                        </div>
                        <div v-else class="empty-state">
                            <el-icon :size="32" color="#67c23a">
                                <CircleCheck />
                            </el-icon>
                            <span style="color: #67c23a; margin-left: 8px">无致命错误 ✅</span>
                        </div>
                    </el-card>
                </el-col>
                <el-col :span="12">
                    <el-card class="warning-card" shadow="hover">
                        <template #header>
                            <span class="card-title" style="color: #e6a23c">⚠️ 警告</span>
                        </template>
                        <div v-if="evaluation.warnings?.length" class="warning-list">
                            <el-tag v-for="(w, i) in evaluation.warnings" :key="i" type="warning" size="large"
                                style="margin: 4px">
                                {{ w }}
                            </el-tag>
                        </div>
                        <div v-else class="empty-state">
                            <el-icon :size="32" color="#67c23a">
                                <CircleCheck />
                            </el-icon>
                            <span style="color: #67c23a; margin-left: 8px">无警告 ✅</span>
                        </div>
                    </el-card>
                </el-col>
            </el-row>

            <!-- 完整评语 -->
            <el-card class="report-card" shadow="hover">
                <template #header>
                    <div class="card-header">
                        <span class="card-title">📝 详细评语</span>
                        <el-button text @click="showFullReport = !showFullReport">
                            {{ showFullReport ? '收起' : '展开' }}
                        </el-button>
                    </div>
                </template>
                <div class="report-content" :class="{ collapsed: !showFullReport }">
                    <div v-html="formattedReport"></div>
                </div>
                <el-button v-if="!showFullReport" text type="primary" @click="showFullReport = true">
                    展开全文 ▼
                </el-button>
            </el-card>

            <!-- 智能体诊断轨迹 -->
            <el-card v-if="agentTrace" class="agent-card" shadow="hover">
                <template #header>
                    <div class="card-header">
                        <span class="card-title">🤖 多智能体诊断轨迹</span>
                        <el-button text @click="showAgentTrace = !showAgentTrace">
                            {{ showAgentTrace ? '收起' : '展开' }}
                        </el-button>
                    </div>
                </template>
                <el-collapse-transition>
                    <div v-show="showAgentTrace">
                        <el-row :gutter="16">
                            <el-col v-for="(output, name) in agentTrace" :key="name" :span="12">
                                <el-card shadow="hover" size="small" class="agent-item">
                                    <template #header>
                                        <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                      ">
                                            > > > > >
                                            <span style="font-weight: bold">{{ name }}</span>
                                            <el-tag :type="output.score >= 70 ? 'success' : 'warning'" size="small">
                                                {{ output.score }}分
                                            </el-tag>
                                        </div>
                                    </template>
                                    <div class="agent-output">
                                        <p><strong>推理：</strong>{{ output.reasoning }}</p>
                                        <p v-if="output.detailedFindings">
                                            <strong>详细发现：</strong>
                                            <span style="font-size: 13px; color: #666">
                                                {{ JSON.stringify(output.detailedFindings, null, 2) }}
                                            </span>
                                        </p>
                                        <p v-if="output.warnings?.length">
                                            <strong>警告：</strong>
                                            <span v-for="(w, i) in output.warnings" :key="i"
                                                style="color: #e6a23c; margin-right: 8px">
                                                {{ w }}
                                            </span>
                                        </p>
                                        <p v-if="output.recommendations?.length">
                                            <strong>建议：</strong>
                                            <span v-for="(r, i) in output.recommendations" :key="i"
                                                style="color: #409eff; margin-right: 8px">
                                                {{ r }}
                                            </span>
                                        </p>
                                        <p v-if="output.hasCriticalViolation" style="color: #f56c6c">
                                            ❌ 存在致命违规！
                                        </p>
                                    </div>
                                </el-card>
                            </el-col>
                        </el-row>
                    </div>
                </el-collapse-transition>
            </el-card>

            <!-- 完整转写文本 -->
            <el-card class="transcript-card" shadow="hover">
                <template #header>
                    <div class="card-header">
                        <span class="card-title">📝 完整转写文本</span>
                        <el-button text @click="showTranscript = !showTranscript">
                            {{ showTranscript ? '收起' : '展开' }}
                        </el-button>
                    </div>
                </template>
                <el-collapse-transition>
                    <div v-show="showTranscript" class="transcript-content">
                        <pre>{{ transcript || '暂无转写记录' }}</pre>
                    </div>
                </el-collapse-transition>
            </el-card>
        </template>

        <!-- ====== 无数据 ====== -->
        <div v-else class="empty-container">
            <el-empty description="暂无报告数据">
                <el-button type="primary" @click="handleBack">返回考核</el-button>
            </el-empty>
        </div>
    </div>
</template>

<style scoped lang="scss">
.ems-report {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;

    .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        h2 {
            margin: 0;
            font-size: 22px;
        }
    }

    .header-right {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
}

.loading-container {
    padding: 40px;
}

.card-title {
    font-size: 16px;
    font-weight: bold;
}

.info-card {
    margin-bottom: 16px;
}

.score-card {
    margin-bottom: 16px;

    .score-display {
        text-align: center;
        padding: 16px;
        border-radius: 8px;

        .score-number {
            font-size: 52px;
            font-weight: bold;
        }

        .score-label {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }

        .score-level {
            font-size: 16px;
            margin-top: 4px;
            font-weight: bold;
        }

        &.level-excellent {
            background: #f0f9eb;

            .score-number {
                color: #67c23a;
            }

            .score-level {
                color: #67c23a;
            }
        }

        &.level-good {
            background: #ecf5ff;

            .score-number {
                color: #409eff;
            }

            .score-level {
                color: #409eff;
            }
        }

        &.level-average {
            background: #fdf6ec;

            .score-number {
                color: #e6a23c;
            }

            .score-level {
                color: #e6a23c;
            }
        }

        &.level-poor {
            background: #fef0f0;

            .score-number {
                color: #f56c6c;
            }

            .score-level {
                color: #f56c6c;
            }
        }

        &.level-fail {
            background: #fef0f0;

            .score-number {
                color: #f56c6c;
            }

            .score-level {
                color: #f56c6c;
            }
        }
    }

    .dimension-score {
        padding: 8px 12px;

        .dimension-label {
            font-size: 13px;
            color: #666;
            margin-bottom: 4px;
        }

        .dimension-value {
            text-align: right;
            font-size: 13px;
            color: #666;
            margin-top: 2px;
        }
    }
}

.error-card,
.warning-card {
    margin-bottom: 16px;

    .error-list,
    .warning-list {
        min-height: 48px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
    }
}

.report-card {
    margin-bottom: 16px;

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .report-content {
        line-height: 1.8;
        font-size: 14px;

        &.collapsed {
            max-height: 200px;
            overflow: hidden;
        }
    }
}

.agent-card {
    margin-bottom: 16px;

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .agent-item {
        margin-bottom: 12px;

        .agent-output {
            font-size: 13px;
            line-height: 1.8;

            p {
                margin: 4px 0;
            }
        }
    }
}

.transcript-card {
    margin-bottom: 16px;

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .transcript-content {
        pre {
            font-family: inherit;
            font-size: 14px;
            line-height: 1.8;
            white-space: pre-wrap;
            word-break: break-all;
            background: #f8f9fa;
            padding: 16px;
            border-radius: 4px;
            max-height: 400px;
            overflow-y: auto;
            margin: 0;
        }
    }
}

.empty-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
}

// 响应式
@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .score-card .score-display .score-number {
        font-size: 36px;
    }

    .agent-card .agent-item {
        .el-col {
            width: 100%;
        }
    }
}
</style>
