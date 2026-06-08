import { useCallback, useEffect, useState } from 'react'
import type { Room } from '../shared/types'
import AppNav from './components/AppNav'
import RoomTabs from './components/RoomTabs'
import RoomNotesPanel from './components/RoomNotesPanel'
import { useNavHistory, type Screen } from './navigation/useNavHistory'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import CreateRoomScreen from './screens/CreateRoomScreen'
import JoinRoomScreen from './screens/JoinRoomScreen'
import KanbanScreen from './screens/KanbanScreen'
import CalendarScreen from './screens/CalendarScreen'
import TeamScreen from './screens/TeamScreen'
import OverdueReportScreen from './screens/OverdueReportScreen'
import ChiefDashboardScreen from './screens/ChiefDashboardScreen'
import ArchiveScreen from './screens/ArchiveScreen'
import ExchangeScreen from './screens/ExchangeScreen'
import ThemeToggle from './components/ThemeToggle'
import AppUpdatePanel from './components/AppUpdatePanel'
import TooltipWrap from './components/TooltipWrap'
import { useHelp } from './context/HelpContext'
import { USER_HELP_ANCHORS, type UserHelpAnchorId } from '../shared/helpAnchors'
import { UI_HINTS } from './hints/uiHints'
import SyncToast from './components/SyncToast'
import { useAppTheme } from './hooks/useAppTheme'
import { useSyncNotifications } from './hooks/useSyncNotifications'
import { useOverdueCount } from './hooks/useOverdueCount'
import { useRoomTasks } from './hooks/useRoomTasks'
import { useAppUpdate } from './hooks/useAppUpdate'

const MENU_SCREEN_MAP: Record<string, Screen> = {
  welcome: 'welcome',
  create: 'create',
  join: 'join',
  calendar: 'calendar',
  team: 'team',
  overdue: 'overdue',
  dashboard: 'dashboard',
  archive: 'archive',
  exchange: 'exchange'
}

export default function App() {
  const { openHelp } = useHelp()
  const { theme, toggleTheme } = useAppTheme()
  const { screen, navigate, back, canBack } = useNavHistory('welcome')
  const [room, setRoom] = useState<Room | null>(null)
  const [joinFolder, setJoinFolder] = useState<string | null>(null)
  const [createFolder, setCreateFolder] = useState<string | null>(null)

  const inRoomView =
    room !== null &&
    (screen === 'kanban' ||
      screen === 'calendar' ||
      screen === 'team' ||
      screen === 'overdue' ||
      screen === 'dashboard' ||
      screen === 'archive' ||
      screen === 'exchange')

  const {
    tasks: roomTasks,
    refresh: refreshRoomTasks,
    loadError: roomTasksLoadError
  } = useRoomTasks(room?.path ?? '')
  const overdueCount = useOverdueCount(roomTasks)
  const { toast: syncToast, dismissToast } = useSyncNotifications(inRoomView)
  const [syncRefreshing, setSyncRefreshing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const { status: appUpdateStatus, panelOpen, startUpdate, closePanel, openPanel } = useAppUpdate()

  const currentEmployeeName =
    room && room.state.employees[room.pcId]
      ? room.state.employees[room.pcId].name
      : null

  const updateRoom = useCallback((r: Room) => {
    setRoom(r)
  }, [])

  const goToKanban = useCallback(
    (r: Room) => {
      setRoom(r)
      navigate('kanban', { reset: true })
    },
    [navigate]
  )

  const goWelcome = useCallback(() => {
    setRoom(null)
    navigate('welcome', { reset: true })
  }, [navigate])

  useEffect(() => {
    void window.api.getCurrentRoom().then((r) => {
      if (r) {
        setRoom(r)
        navigate('kanban', { reset: true })
      }
    })

    const unsubNav = window.api.onNavigate((s) => {
      if (
        s === 'calendar' ||
        s === 'team' ||
        s === 'overdue' ||
        s === 'dashboard' ||
        s === 'archive' ||
        s === 'exchange'
      ) {
        void window.api.getCurrentRoom().then((r) => {
          if (r) {
            if ((s === 'overdue' || s === 'dashboard') && !r.isChief) {
              navigate('kanban')
              return
            }
            setRoom(r)
            navigate(s as Screen)
          }
        })
        return
      }
      const target = MENU_SCREEN_MAP[s]
      if (target) {
        if (target === 'welcome') setRoom(null)
        navigate(target)
      }
    })

    const unsubAuto = window.api.onRoomAutoOpened((r) => {
      setRoom(r)
      navigate('kanban', { reset: true })
    })

    const unsubClosed = window.api.onRoomClosed(() => {
      setRoom(null)
      navigate('welcome', { reset: true })
    })

    const unsubHelp = window.api.onOpenHelp((anchor) => {
      openHelp((anchor as UserHelpAnchorId | null) ?? USER_HELP_ANCHORS.hints)
    })

    return () => {
      unsubNav()
      unsubAuto()
      unsubClosed()
      unsubHelp()
    }
  }, [navigate, openHelp])

  return (
    <div className="app">
      <SyncToast toast={syncToast} onDismiss={dismissToast} />
      <header className="app-header">
        <div className="header-left">
          <div className="brand-row">
            <h1 className="app-brand">
              <img src="./icon.png" alt="" className="app-brand-icon" width={28} height={28} />
              RoomKanban
            </h1>
            <AppNav canBack={canBack && !inRoomView} onBack={back} />
            <button
              type="button"
              className="btn btn-ghost btn-sm doc-help-btn"
              onClick={() => openHelp(USER_HELP_ANCHORS.hints)}
              title="Справка по приложению"
            >
              Справка
            </button>
            <AppUpdatePanel
              status={appUpdateStatus}
              open={panelOpen}
              onClose={closePanel}
              onUpdate={() => {
                openPanel()
                startUpdate()
              }}
            />
            <ThemeToggle theme={theme} onToggle={() => void toggleTheme()} />
          </div>
          {inRoomView && room && (
            <>
              <RoomTabs
                active={
                  screen === 'calendar'
                    ? 'calendar'
                    : screen === 'team'
                      ? 'team'
                      : screen === 'overdue'
                        ? 'overdue'
                        : screen === 'dashboard'
                          ? 'dashboard'
                          : screen === 'archive'
                            ? 'archive'
                            : screen === 'exchange'
                              ? 'exchange'
                              : 'kanban'
                }
                isChief={room.isChief}
                overdueCount={overdueCount}
                onChange={(s) => navigate(s, { replace: true })}
              />
              <div className="room-bar">
                <div className="room-bar-info">
                  <strong>{room.state.room_name}</strong>
                  {currentEmployeeName && (
                    <span className="room-bar-user">Вы: {currentEmployeeName}</span>
                  )}
                </div>
                <div className="room-bar-actions">
                  <TooltipWrap text={UI_HINTS.roomBar.sync}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={syncRefreshing}
                      onClick={() => {
                        setSyncRefreshing(true)
                        setSyncError(null)
                        void window.api
                          .refreshRoomSync()
                          .catch((err: unknown) => {
                            setSyncError(
                              err instanceof Error ? err.message : 'Не удалось обновить синхронизацию'
                            )
                          })
                          .finally(() => setSyncRefreshing(false))
                      }}
                    >
                      {syncRefreshing ? 'Обновление…' : 'Обновить синхронизацию'}
                    </button>
                  </TooltipWrap>
                  {syncError && (
                    <span className="room-bar-sync-error" role="alert">
                      {syncError}
                    </span>
                  )}
                  <TooltipWrap text={UI_HINTS.roomBar.leave}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await window.api.closeRoom()
                        goWelcome()
                      }}
                    >
                      Другая комната
                    </button>
                  </TooltipWrap>
                </div>
              </div>
              <RoomNotesPanel roomPath={room.path} />
            </>
          )}
        </div>
      </header>

      <main
        className={`app-main ${inRoomView ? 'room-view' : ''} ${screen === 'kanban' ? 'kanban' : ''} ${screen === 'calendar' ? 'calendar' : ''} ${screen === 'team' ? 'team' : ''} ${screen === 'overdue' ? 'overdue' : ''} ${screen === 'dashboard' ? 'dashboard' : ''} ${screen === 'archive' ? 'archive' : ''} ${screen === 'exchange' ? 'exchange' : ''}`}
      >
        {screen === 'welcome' && (
          <WelcomeScreen
            onCreate={() => navigate('create')}
            onOpen={() => {
              setJoinFolder(null)
              navigate('join')
            }}
            onFirstLaunch={() => navigate('onboarding')}
            onOpenRecent={(path) => {
              setJoinFolder(path)
              navigate('join')
            }}
          />
        )}
        {screen === 'onboarding' && (
          <OnboardingScreen
            onContinue={(mode, folderPath) => {
              if (mode === 'create') {
                setCreateFolder(folderPath)
                navigate('create')
              } else {
                setJoinFolder(folderPath)
                navigate('join')
              }
            }}
          />
        )}
        {screen === 'create' && (
          <CreateRoomScreen initialFolder={createFolder} onCreated={goToKanban} />
        )}
        {screen === 'join' && (
          <JoinRoomScreen initialFolder={joinFolder} onJoined={goToKanban} />
        )}
        {screen === 'kanban' && room && (
          <KanbanScreen
            room={room}
            tasks={roomTasks}
            onTasksChange={refreshRoomTasks}
            tasksLoadError={roomTasksLoadError}
            overdueCount={overdueCount}
            onOpenOverdue={
              room.isChief ? () => navigate('overdue', { replace: true }) : undefined
            }
          />
        )}
        {screen === 'calendar' && room && (
          <CalendarScreen room={room} tasks={roomTasks} onTasksChange={refreshRoomTasks} />
        )}
        {screen === 'team' && room && (
          <TeamScreen room={room} onRoomUpdated={updateRoom} />
        )}
        {screen === 'overdue' && room && room.isChief && (
          <OverdueReportScreen room={room} onTasksChanged={refreshRoomTasks} />
        )}
        {screen === 'dashboard' && room && room.isChief && (
          <ChiefDashboardScreen
            room={room}
            onOpenOverdue={() => navigate('overdue', { replace: true })}
            onTasksChanged={refreshRoomTasks}
          />
        )}
        {screen === 'archive' && room && (
          <ArchiveScreen room={room} onTasksChanged={refreshRoomTasks} />
        )}
        {screen === 'exchange' && room && <ExchangeScreen room={room} />}
      </main>
    </div>
  )
}
