import { Card, Typography, Space, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SlotPicker, { type SlotState } from '../../components/SlotPicker';
import { listTimeSlots, upsertTimeSlot } from '../../api/timeSlots';

/**
 * 時段開放設定：對應「時段開放設定」。逐格點擊切換開放／關閉，尚未建立紀錄的格子
 * 視為預設開放（對應後端 time_slots 表註解）。
 */
export default function SlotSettings() {
  const queryClient = useQueryClient();

  const { data: slots, isLoading } = useQuery({ queryKey: ['time-slots'], queryFn: listTimeSlots });

  const isOpenByKey = new Map((slots ?? []).map((s) => [`${s.day_of_week}-${s.start_hour}`, s.is_open]));

  const toggleMutation = useMutation({
    mutationFn: upsertTimeSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-slots'] });
    },
    onError: () => message.error('更新失敗，請稍後再試'),
  });

  const cellState = (dayOfWeek: number, hour: number): SlotState => {
    const isOpen = isOpenByKey.get(`${dayOfWeek}-${hour}`) ?? true;
    return isOpen ? 'empty' : 'closed';
  };

  const handleCellClick = (dayOfWeek: number, hour: number) => {
    const isOpen = isOpenByKey.get(`${dayOfWeek}-${hour}`) ?? true;
    toggleMutation.mutate({ day_of_week: dayOfWeek, start_hour: hour, is_open: !isOpen });
  };

  return (
    <Card loading={isLoading}>
      <Typography.Title level={4} style={{ marginBottom: 4 }}>
        時段開放設定
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        點擊格子切換該時段開放／關閉，關閉後會員與管理員皆無法在該時段建立預約。灰色為開放中，橘色為已關閉。
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }}>
        <SlotPicker cellState={cellState} onCellClick={handleCellClick} />
      </Space>
    </Card>
  );
}
