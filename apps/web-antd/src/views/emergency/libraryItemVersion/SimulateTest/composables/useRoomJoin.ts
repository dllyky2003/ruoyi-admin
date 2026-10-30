import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { request } from '../../../../../utils/request';

export interface RoomSummary {
  sessionId: string;
  caseId: string;
  templateId: string;
  state: string;
  clientCount: number;
  roles: string[];
  createdAt: number;
  lastActivityAt: number;
}

/**
 * 以 speaker 身份加入 Unity（engine）已创建的房间。
 * - 支持房间列表拉取（下拉框）
 * - 调 REST /ems/room/{sessionId}/join 拿 wsToken
 * - 打开 WebSocket，保持连接直到调用 dispose() 或 handleLeaveRoom()
 */
export function useRoomJoin() {
  // ===== 房间列表 =====
  const rooms = ref<RoomSummary[]>([]);
  const isLoadingRooms = ref(false);

  // ===== 加入状态 =====
  const joinRoomId = ref('');
  const isJoining = ref(false);
  const roomJoined = ref(false);
  const roomWsConnected = ref(false);
  let roomWs: null | WebSocket = null;

  /**
   * 拉取房间列表。
   * @param state 可选，按状态过滤：WAITING / ACTIVE / PAUSED / COMPLETED / EXPIRED
   *              不传则返回服务端默认的活跃房间
   */
  const loadRooms = async (state?: string) => {
    isLoadingRooms.value = true;
    try {
      const params: Record<string, string> = {};
      if (state) params.state = state;

      const result: any = await request.get('/ems/room/list', { params });

      // 兼容封装：{ code, msg, data: [...] } 或直接是数组
      const body = result?.data ?? result;
      const list: RoomSummary[] = body?.data ?? body ?? [];

      rooms.value = Array.isArray(list) ? list : [];

      // 如果当前选中的房间已经不在列表里，清空
      if (
        joinRoomId.value &&
        !rooms.value.some((r) => r.sessionId === joinRoomId.value)
      ) {
        joinRoomId.value = '';
      }

      // 默认选中最新一条（如果还没选）
      if (!joinRoomId.value && rooms.value.length > 0) {
        const sorted = [...rooms.value].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        joinRoomId.value = sorted[0].sessionId;
      }

      console.log(`[Room] 加载 ${rooms.value.length} 个房间`);
    } catch (error: any) {
      console.error('[Room] 加载房间列表失败', error);
      const msg = error?.response?.data?.msg || error?.message || '未知错误';
      message.error(`加载房间列表失败: ${msg}`);
      rooms.value = [];
    } finally {
      isLoadingRooms.value = false;
    }
  };

  /** 修正服务端返回的 wsUrl：本地开发时把 localhost/127.0.0.1 换成当前页面 host */
  const normalizeWsUrl = (raw: string): string => {
    return raw
      .replace(/^ws:\/\/localhost:\d+/, `ws://${location.host}`)
      .replace(/^ws:\/\/127\.0\.0\.1:\d+/, `ws://${location.host}`);
  };

  const handleJoinRoom = async () => {
    const sid = joinRoomId.value.trim();
    if (!sid) {
      message.warning('请先选择一个房间');
      return;
    }
    if (isJoining.value) return;

    isJoining.value = true;
    try {
      // 1. REST 加入房间
      const result: any = await request.post(`/ems/room/${sid}/join`, {
        role: 'speaker',
        userId: 'vue-speaker',
      });

      const body = result?.data ?? result;
      const payload = body?.data ?? body;

      if (!payload || !payload.wsToken || !payload.wsUrl) {
        message.error(`加入失败：${body?.msg || '返回体缺少 wsToken / wsUrl'}`);
        return;
      }

      const { wsToken, wsUrl } = payload as {
        wsToken: string;
        wsUrl: string;
      };
      const finalUrl = normalizeWsUrl(wsUrl);

      console.log('[Room] 连接:', finalUrl, 'token=', wsToken);

      // 2. 打开 WebSocket
      roomWs?.close();
      roomWs = new WebSocket(finalUrl);

      roomWs.addEventListener('open', () => {
        roomWsConnected.value = true;
        roomJoined.value = true;
        message.success(`✅ 已加入房间 ${sid}（speaker）`);
        console.log('[Room] ✅ 已连接');
      });

      roomWs.onmessage = (e) => {
        console.log('[Room] ←', e.data);
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'case_start' || msg.type === 'case_config') {
            message.info(`收到 ${msg.type}`);
          }
        } catch {
          /* 忽略非 JSON 消息 */
        }
      };

      roomWs.onerror = (e) => {
        console.error('[Room] 错误', e);
        message.error('Room WebSocket 错误');
      };

      roomWs.addEventListener('close', () => {
        roomWsConnected.value = false;
        console.log('[Room] ❌ 已断开');
      });
    } catch (error: any) {
      console.error('[Room] 加入异常', error);
      const msg = error?.response?.data?.msg || error?.message || '未知错误';
      message.error(`加入失败: ${msg}`);
    } finally {
      isJoining.value = false;
    }
  };

  const handleLeaveRoom = () => {
    if (roomWs) {
      roomWs.close();
      roomWs = null;
    }
    roomJoined.value = false;
    roomWsConnected.value = false;
    message.info('已离开房间');
  };

  /** 组件卸载时调用，避免连接泄漏 */
  const dispose = () => {
    if (roomWs) {
      roomWs.close();
      roomWs = null;
    }
    roomJoined.value = false;
    roomWsConnected.value = false;
  };

  return {
    // 房间列表
    rooms,
    isLoadingRooms,
    loadRooms,

    // 加入相关
    joinRoomId,
    isJoining,
    roomJoined,
    roomWsConnected,
    handleJoinRoom,
    handleLeaveRoom,
    dispose,
  };
}
