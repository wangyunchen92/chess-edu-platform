import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { userApi } from '@/api/user'
import * as studentApi from '@/api/student'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Avatar from '@/components/common/Avatar'
import Loading from '@/components/common/Loading'
import type { MyTeacherItem } from '@/types/api'

type BoardTheme = 'indigo' | 'green' | 'wood'

const BOARD_THEMES: { key: BoardTheme; label: string; light: string; dark: string }[] = [
  { key: 'indigo', label: '靛蓝', light: '#c8d4e8', dark: '#5b6eae' },
  { key: 'green', label: '经典绿', light: '#ebecd0', dark: '#779556' },
  { key: 'wood', label: '木质', light: '#f0d9b5', dark: '#b58863' },
]

const MEMBERSHIP_LABEL: Record<string, string> = {
  free: '免费版',
  basic: '基础会员',
  premium: '高级会员',
}

const SettingsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const [boardTheme, setBoardTheme] = useState<BoardTheme>(
    () => (localStorage.getItem('boardTheme') as BoardTheme) || 'indigo'
  )
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [nickSaved, setNickSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Load user settings from backend on mount
  useEffect(() => {
    setLoading(true)
    setError(null)
    userApi.getProfile()
      .then((res) => {
        const payload = res.data?.data ?? res.data
        if (payload) {
          setNickname(payload.nickname ?? user?.nickname ?? '')
          // Extract settings from profile sub-object
          const profile = payload.profile
          if (profile) {
            setSoundEnabled(profile.sound_enabled ?? true)
            setNotificationEnabled(profile.notification_enabled ?? true)
            setReminderTime(profile.daily_remind_time ?? '18:00')
          }
        }
      })
      .catch((err) => {
        console.error('[SettingsPage] Failed to load user settings:', err)
        setError('加载设置失败，请刷新页面重试')
        // Fall back to localStorage values
        setSoundEnabled(localStorage.getItem('soundEnabled') !== 'false')
        setNotificationEnabled(localStorage.getItem('dailyReminder') !== 'false')
        setReminderTime(localStorage.getItem('reminderTime') || '18:00')
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBoardTheme = (t: BoardTheme) => {
    setBoardTheme(t)
    localStorage.setItem('boardTheme', t)
  }

  const persistSettings = (updates: {
    sound_enabled?: boolean
    notification_enabled?: boolean
    daily_remind_time?: string
  }) => {
    setSettingsSaving(true)
    userApi.updateSettings(updates)
      .catch((err) => {
        console.error('[SettingsPage] Failed to save settings:', err)
      })
      .finally(() => setSettingsSaving(false))
  }

  const handleSound = (v: boolean) => {
    setSoundEnabled(v)
    localStorage.setItem('soundEnabled', String(v))
    persistSettings({ sound_enabled: v })
  }

  const handleNotification = (v: boolean) => {
    setNotificationEnabled(v)
    localStorage.setItem('dailyReminder', String(v))
    persistSettings({ notification_enabled: v })
  }

  const handleReminderTime = (t: string) => {
    setReminderTime(t)
    localStorage.setItem('reminderTime', t)
    persistSettings({ daily_remind_time: t })
  }

  const handleSaveNickname = async () => {
    try {
      const res = await userApi.updateProfile({ nickname })
      const payload = res.data?.data ?? res.data
      if (payload && user) {
        useAuthStore.getState().setUser({ ...user, nickname: payload.nickname ?? nickname })
      }
      setNickSaved(true)
      setTimeout(() => setNickSaved(false), 2000)
    } catch (err) {
      console.error('[SettingsPage] Failed to save nickname:', err)
      // Still update locally
      if (user) {
        useAuthStore.getState().setUser({ ...user, nickname })
      }
      setNickSaved(true)
      setTimeout(() => setNickSaved(false), 2000)
    }
  }

  if (loading) {
    return <Loading size="lg" text="加载设置..." />
  }

  const membershipTier = user?.membership_tier ?? 'free'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Title */}
      <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
        {'\u2699\uFE0F'} 设置
      </h1>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* ── Appearance ── */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          {'\uD83C\uDFA8'} 外观设置
        </h3>
        <div className="space-y-5">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">主题模式</p>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">切换深色/浅色主题</p>
            </div>
            <button
              className="w-14 h-8 rounded-full relative transition-colors duration-200"
              style={{ background: theme === 'dark' ? 'var(--accent)' : 'var(--border)' }}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <div
                className="w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-[left] duration-200 flex items-center justify-center text-xs"
                style={{ left: theme === 'dark' ? 'calc(100% - 28px)' : '4px' }}
              >
                {theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F'}
              </div>
            </button>
          </div>

          {/* Board Theme */}
          <div>
            <p className="text-[var(--text-sm)] font-medium text-[var(--text)] mb-2">棋盘主题</p>
            <div className="flex gap-4">
              {BOARD_THEMES.map((bt) => (
                <button
                  key={bt.key}
                  className="flex flex-col items-center gap-1.5 cursor-pointer"
                  onClick={() => handleBoardTheme(bt.key)}
                >
                  {/* Mini board preview */}
                  <div
                    className="w-14 h-14 rounded-[var(--radius-sm)] overflow-hidden grid grid-cols-2 grid-rows-2 transition-all"
                    style={{
                      outline: boardTheme === bt.key
                        ? '2.5px solid var(--accent)'
                        : '2px solid var(--border)',
                      outlineOffset: 1,
                    }}
                  >
                    <div style={{ background: bt.light }} />
                    <div style={{ background: bt.dark }} />
                    <div style={{ background: bt.dark }} />
                    <div style={{ background: bt.light }} />
                  </div>
                  <span
                    className="text-[var(--text-xs)] font-medium"
                    style={{ color: boardTheme === bt.key ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {bt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Sound & Notification ── */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          {'\uD83D\uDD14'} 声音与通知
          {settingsSaving && <span className="text-[var(--text-xs)] text-[var(--text-muted)] ml-2">保存中...</span>}
        </h3>
        <div className="space-y-4">
          {/* Sound */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">音效</p>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">走棋、吃子等操作音效</p>
            </div>
            <button
              className="w-14 h-8 rounded-full relative transition-colors duration-200"
              style={{ background: soundEnabled ? 'var(--success)' : 'var(--border)' }}
              onClick={() => handleSound(!soundEnabled)}
            >
              <div
                className="w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-[left] duration-200"
                style={{ left: soundEnabled ? 'calc(100% - 28px)' : '4px' }}
              />
            </button>
          </div>

          {/* Notification */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">每日提醒</p>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">提醒完成每日训练</p>
            </div>
            <button
              className="w-14 h-8 rounded-full relative transition-colors duration-200"
              style={{ background: notificationEnabled ? 'var(--success)' : 'var(--border)' }}
              onClick={() => handleNotification(!notificationEnabled)}
            >
              <div
                className="w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-[left] duration-200"
                style={{ left: notificationEnabled ? 'calc(100% - 28px)' : '4px' }}
              />
            </button>
          </div>

          {notificationEnabled && (
            <div className="flex items-center gap-3 pl-4">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">提醒时间</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleReminderTime(e.target.value)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)]"
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Account ── */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          {'\uD83D\uDC64'} 账号信息
        </h3>
        <div className="space-y-4">
          {/* Username (readonly) */}
          <div>
            <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">用户名</label>
            <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)] text-[var(--text-sm)] text-[var(--text-muted)]">
              {user?.username ?? '-'}
            </div>
          </div>

          {/* Nickname (editable) */}
          <div>
            <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">昵称</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
                placeholder="输入昵称"
              />
              <Button variant="primary" size="sm" onClick={handleSaveNickname}>
                {nickSaved ? '\u2705 已保存' : '保存'}
              </Button>
            </div>
          </div>

          {/* Membership */}
          <div>
            <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">会员状态</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)]">
              <span className="text-lg">{'\uD83C\uDF1F'}</span>
              <span className="text-[var(--text-sm)] text-[var(--text)]">
                {MEMBERSHIP_LABEL[membershipTier] ?? membershipTier}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── About ── */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
          {'\u2139\uFE0F'} 关于
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-sm)] text-[var(--text-sub)]">版本号</span>
            <span className="text-[var(--text-sm)] text-[var(--text-muted)] tabular-nums">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-sm)] text-[var(--text-sub)]">产品名称</span>
            <span className="text-[var(--text-sm)] text-[var(--text)]">{'\u265E'} 棋智少年</span>
          </div>
        </div>
      </Card>
      {/* ── Join Teacher (student only) ── */}
      {user?.role === 'student' && (
        <JoinTeacherSection />
      )}

      {/* Logout */}
      <button
        onClick={() => {
          logout()
          window.location.href = import.meta.env.BASE_URL || '/'
        }}
        className="w-full py-3 rounded-xl text-center text-[var(--danger)] font-semibold bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
      >
        退出登录
      </button>
    </div>
  )
}

// ── Join Teacher sub-component ──────────────────────────────────

const JoinTeacherSection: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast)

  const [myTeachers, setMyTeachers] = useState<MyTeacherItem[]>([])
  const [teachersLoading, setTeachersLoading] = useState(true)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)

  const loadTeachers = useCallback(async () => {
    setTeachersLoading(true)
    try {
      const res = await studentApi.getMyTeachers()
      const data = res.data?.data ?? res.data
      setMyTeachers(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setTeachersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase()
    if (code.length !== 6) {
      setJoinError('请输入6位邀请码')
      return
    }
    setJoining(true)
    setJoinError(null)
    setJoinSuccess(null)
    try {
      const res = await studentApi.joinTeacher({ invite_code: code })
      const data = res.data?.data ?? res.data
      setJoinSuccess(`已成功加入 ${data.teacher_nickname} 老师`)
      setInviteCode('')
      addToast('success', `已加入 ${data.teacher_nickname} 老师`)
      loadTeachers()
      setTimeout(() => {
        setShowJoinModal(false)
        setJoinSuccess(null)
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加入失败'
      setJoinError(msg)
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async (teacherId: string, name: string) => {
    try {
      await studentApi.leaveTeacher(teacherId)
      addToast('success', `已离开 ${name} 老师`)
      loadTeachers()
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <>
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          我的老师
        </h3>

        {/* Join teacher button */}
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setShowJoinModal(true)
            setJoinError(null)
            setJoinSuccess(null)
            setInviteCode('')
          }}
          className="mb-4"
        >
          加入老师
        </Button>

        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-4">
          向老师要一个6位邀请码，输入后就能加入啦
        </p>

        {/* Teacher list */}
        {teachersLoading ? (
          <div className="py-4 text-center text-[var(--text-muted)] text-[var(--text-sm)]">
            加载中...
          </div>
        ) : myTeachers.length === 0 ? (
          <div className="py-4 text-center text-[var(--text-muted)] text-[var(--text-sm)]">
            还没有加入老师
          </div>
        ) : (
          <div className="space-y-3">
            {myTeachers.map((t) => (
              <div
                key={t.teacher_id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]"
              >
                <Avatar
                  src={t.teacher_avatar_url}
                  name={t.teacher_nickname}
                  size="md"
                />
                <div className="flex-1">
                  <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">
                    {t.teacher_nickname} 老师
                  </p>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    {new Date(t.bindtime).toLocaleDateString('zh-CN')} 加入
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleLeave(t.teacher_id, t.teacher_nickname)}
                >
                  离开
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Join modal */}
      <Modal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="加入老师"
        width="400px"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            输入老师给你的6位邀请码
          </p>

          {/* Code input - large, centered, monospace */}
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => {
              const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
              setInviteCode(v)
              setJoinError(null)
            }}
            className="w-full text-center font-mono text-3xl tracking-[0.3em] font-bold py-4 rounded-[var(--radius-sm)] border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
            placeholder="______"
            maxLength={6}
            autoFocus
          />

          {/* Error */}
          {joinError && (
            <p className="text-[var(--text-sm)] text-[var(--danger)]">
              {joinError}
            </p>
          )}

          {/* Success */}
          {joinSuccess && (
            <p className="text-[var(--text-sm)] text-[var(--success)] font-medium">
              {joinSuccess}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleJoin}
            loading={joining}
            disabled={inviteCode.length !== 6}
          >
            加入
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default SettingsPage
