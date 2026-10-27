import { Alert, Avatar, Checkbox, Form, Input, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCoaches, type Coach } from '../../../../../api/coaches';
import type { SiteContent } from '../../../../../api/website';
import { moveItem, type PanelProps } from '../../lib';
import { ListItemActions } from '../ListItemActions';

type Coaches = SiteContent['coaches'];

/**
 * 教練團隊：勾選要公開的教練與順序，加上網站用的自我介紹。
 * 照片、授課名稱、專長來自教練管理；電話、LINE、匯款帳號、鐘點費不會公開。
 */
export function CoachesPanel({ value, onChange }: PanelProps<Coaches>) {
  const { data: coaches = [], isLoading } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const byId = new Map(coaches.map((c) => [c.id, c]));
  const publicIds = new Set(value.items.map((i) => i.coach_id));
  const shown = value.items.filter((i) => byId.has(i.coach_id));
  const others = coaches.filter((c) => !publicIds.has(c.id));

  const setItems = (items: Coaches['items']) => onChange({ ...value, items });
  const displayName = (c: Coach) => c.alias || c.name;

  return (
    <Form layout="vertical">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={
          <>
            網站只會顯示照片、授課名稱、專長與下方的自我介紹；電話、LINE、匯款帳號、鐘點費不會公開。照片與專長在
            <Link to="/admin/coaches">教練管理</Link>編輯。
          </>
        }
      />
      <Form.Item htmlFor="site-coaches-1" label="段落標題">
        <Input id="site-coaches-1" value={value.title} maxLength={30} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        公開的教練（{shown.length}）
      </Typography.Title>
      <List
        loading={isLoading}
        dataSource={shown}
        locale={{ emptyText: '還沒有公開的教練，從下方勾選' }}
        renderItem={(item, index) => {
          const coach = byId.get(item.coach_id)!;
          return (
            <List.Item
              actions={[
                <ListItemActions
                  key="move"
                  index={index}
                  count={shown.length}
                  label={displayName(coach)}
                  onMove={(d) => setItems(moveItem(shown, index, d))}
                />,
                <Checkbox key="public" checked onChange={() => setItems(shown.filter((x) => x.coach_id !== item.coach_id))}>
                  公開
                </Checkbox>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar shape="square" size={48} src={coach.photo_url || undefined}>{displayName(coach).charAt(0)}</Avatar>}
                title={
                  <Space wrap>
                    {displayName(coach)}
                    <Typography.Text type="secondary">{coach.specialty}</Typography.Text>
                  </Space>
                }
                description={
                  <Input.TextArea
                    value={item.bio}
                    maxLength={80}
                    showCount
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    placeholder="網站自我介紹（80 字內）"
                    aria-label={`${displayName(coach)} 的網站自我介紹`}
                    onChange={(e) =>
                      setItems(shown.map((x) => (x.coach_id === item.coach_id ? { ...x, bio: e.target.value } : x)))
                    }
                  />
                }
              />
            </List.Item>
          );
        }}
      />

      {others.length > 0 && (
        <>
          <Typography.Title level={5}>未公開</Typography.Title>
          <List
            dataSource={others}
            renderItem={(coach) => (
              <List.Item
                actions={[
                  <Checkbox key="public" checked={false} onChange={() => setItems([...shown, { coach_id: coach.id, bio: '' }])}>
                    公開
                  </Checkbox>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar shape="square" size={40} src={coach.photo_url || undefined}>{displayName(coach).charAt(0)}</Avatar>}
                  title={displayName(coach)}
                  description={
                    <Space wrap size={4}>
                      {coach.coach_types.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                      {coach.coach_types.includes('場租教練') && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          場租教練不是工作室的教練，通常不公開
                        </Typography.Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Form>
  );
}
