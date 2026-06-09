import { useCallback, useEffect, useState } from 'react'
import type { Room } from '../shared/types'
import AppNav from './components/AppNav'
import RoomTabs from './components/RoomTabs'
import RoomLabelsSettings from './components/RoomLabelsSettings'
import { useNavHistory, type Screen } from './navigation/useNavHistory'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import CreateRoomScreen from './screens/CreateRoomScreen'
import JoinRoomScreen from './screens/JoinRoomScreen'
import KanbanScreen from './screens/KanbanScreen'
import EmployeeKanbanScreen from './screens/EmployeeKanbanScreen'
import CalendarScreen from './screens/CalendarScreen'
import TeamScreen from './screens/TeamScreen'
import OverdueReportScreen from './screens/OverdueReportScreen'
import ChiefDashboardScreen from './screens/ChiefDashboardScreen'
import DepartmentMailScreen from './screens/DepartmentMailScreen'
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
import { useTaskTypes } from './hooks/useTaskTypes'
import { SEED_TEST_TASK_COUNT } from '../shared/seedTestTasks'

const MENU_SCREEN_MAP: Record<string, Screen> = {
  welcome: 'welcome',
  create: 'create',
  join: 'join',
  calendar: 'calendar',
  kanban: 'kanban',
  myTasks: 'myTasks',
  myCalendar: 'myCalendar',
  kanbanByEmployee: 'kanbanByEmployee',
  team: 'team',
  overdue: 'overdue',
  dashboard: 'dashboard',
  archive: 'archive',
  exchange: 'exchange',
  departmentMail: 'departmentMail'
}

export default function App() {
  const { openHelp } = useHelp()
  const { theme, toggleTheme } = useAppTheme()
  const { screen, navigate, back, canBack } = useNavHistory('welcome')
  const [room, setRoom] = useState<Room | null>(null)
  const [joinFolder, setJoinFolder] = useState<string | null>(null)
  const [createFolder, setCreateFolder] = useState<string | null>(null)
  const [taskTypesOpen, setTaskTypesOpen] = useState(false)

  const inRoomView =
    room !== null &&
    (screen === 'myTasks' ||
      screen === 'myCalendar' ||
      screen === 'kanban' ||
      screen === 'kanbanByEmployee' ||
      screen === 'calendar' ||
      screen === 'team' ||
      screen === 'overdue' ||
      screen === 'dashboard' ||
      screen === 'archive' ||
      screen === 'exchange' ||
      screen === 'departmentMail')

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
  const { types: taskTypes, refresh: refreshTaskTypes } = useTaskTypes()

  const currentEmployeeName =
    room && room.state.employees[room.pcId]
      ? room.state.employees[room.pcId].name
      : null

  const updateRoom = useCallback((r: Room) => {
    setRoom(r)
  }, [])

  const goToRoom = useCallback(
    (r: Room) => {
      setRoom(r)
      navigate('myTasks', { reset: true })
    },
    [navigate]
  )

  const goWelcome = useCallback(() => {
    setRoom(null)
    navigate('welcome', { reset: true })
  }, [navigate])

  const handleSeedTestTasks = useCallback(async () => {
    if (
      !window.confirm(
        `Создать ${SEED_TEST_TASK_COUNT} тестовых задач во всех колонках канбана?`
      )
    ) {
      return
    }
    try {
      const { count } = await window.api.seedTestTasks()
      refreshRoomTasks()
      alert(`Добавлено задач: ${count}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось создать тестовые задачи')
    }
  }, [refreshRoomTasks])

  useEffect(() => {
    void window.api.getCurrentRoom().then((r) => {
      if (r) {
        setRoom(r)
        navigate('myTasks', { reset: true })
      }
    })

    const unsubNav = window.api.onNavigate((s) => {
      if (
        s === 'calendar' ||
        s === 'myCalendar' ||
        s === 'kanban' ||
        s === 'kanbanByEmployee' ||
        s === 'myTasks' ||
        s === 'team' ||
        s === 'overdue' ||
        s === 'dashboard' ||
        s === 'archive' ||
        s === 'exchange' ||
        s === 'departmentMail'
      ) {
        void window.api.getCurrentRoom().then((r) => {
          if (r) {
            if (
              (s === 'overdue' || s === 'dashboard' || s === 'departmentMail') &&
              !r.isChief
            ) {
              navigate('myTasks')
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
      navigate('myTasks', { reset: true })
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
            <div className="brand-row-start">
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
              {inRoomView && room && (
                <div className="header-room-info">
                  <span className="header-room-text">{room.state.room_name}</span>
                  {currentEmployeeName && (
                    <span className="header-room-text">Вы: {currentEmployeeName}</span>
                  )}
                  {syncError && (
                    <span className="header-room-error" role="alert">
                      {syncError}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="brand-row-end">
              {inRoomView && room && (
                <div className="header-room-actions">
                  <TooltipWrap text={UI_HINTS.roomBar.sync}>
                    <button
                      type="button"
                      className="btn btn-sm header-action-btn"
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
                  <TooltipWrap text={UI_HINTS.roomBar.leave}>
                    <button
                      type="button"
                      className="btn btn-sm header-action-btn"
                      onClick={async () => {
                        await window.api.closeRoom()
                        goWelcome()
                      }}
                    >
                      Другая комната
                    </button>
                  </TooltipWrap>
                </div>
              )}
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
          </div>
          {inRoomView && room && (
            <>
              <RoomTabs
                active={
                  screen === 'myCalendar'
                    ? 'myCalendar'
                    : screen === 'myTasks'
                      ? 'myTasks'
                    : screen === 'calendar'
                      ? 'calendar'
                    : screen === 'kanban'
                      ? 'kanban'
                    : screen === 'kanbanByEmployee'
                      ? 'kanbanByEmployee'
                    : screen === 'team'
                      ? 'team'
                      : screen === 'overdue'
                        ? 'overdue'
                        : screen === 'dashboard'
                          ? 'dashboard'
                          : screen === 'departmentMail'
                            ? 'departmentMail'
                          : screen === 'archive'
                            ? 'archive'
                            : screen === 'exchange'
                              ? 'exchange'
                              : screen === 'departmentMail'
                                ? 'departmentMail'
                                : 'myTasks'
                }
                isChief={room.isChief}
                roomPath={room.path}
                overdueCount={overdueCount}
                onChange={(s) => navigate(s, { replace: true })}
                onOpenTaskTypes={room.isChief ? () => setTaskTypesOpen(true) : undefined}
                onSeedTestTasks={room.isChief ? () => void handleSeedTestTasks() : undefined}
              />
            </>
          )}
        </div>
      </header>

      <main
        className={`app-main ${inRoomView ? 'room-view' : ''} ${screen === 'kanban' || screen === 'myTasks' || screen === 'kanbanByEmployee' ? 'kanban' : ''} ${screen === 'calendar' || screen === 'myCalendar' ? 'calendar' : ''} ${screen === 'team' ? 'team' : ''} ${screen === 'overdue' ? 'overdue' : ''} ${screen === 'dashboard' ? 'dashboard' : ''} ${screen === 'archive' ? 'archive' : ''} ${screen === 'exchange' ? 'exchange' : ''} ${screen === 'departmentMail' ? 'department-mail' : ''}`}
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
          <CreateRoomScreen initialFolder={createFolder} onCreated={goToRoom} />
        )}
        {screen === 'join' && (
          <JoinRoomScreen initialFolder={joinFolder} onJoined={goToRoom} />
        )}
        {screen === 'myTasks' && room && (
          <KanbanScreen
            room={room}
            tasks={roomTasks}
            scope="mine"
            onTasksChange={refreshRoomTasks}
            tasksLoadError={roomTasksLoadError}
          />
        )}
        {screen === 'myCalendar' && room && (
          <CalendarScreen
            room={room}
            tasks={roomTasks}
            scope="mine"
            onTasksChange={refreshRoomTasks}
          />
        )}
        {screen === 'kanban' && room && (
          <KanbanScreen
            room={room}
            tasks={roomTasks}
            onTasksChange={refreshRoomTasks}
            tasksLoadError={roomTasksLoadError}
          />
        )}
        {screen === 'kanbanByEmployee' && room && (
          <EmployeeKanbanScreen
            room={room}
            tasks={roomTasks}
            onTasksChange={refreshRoomTasks}
            tasksLoadError={roomTasksLoadError}
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
            onOpenMail={() => navigate('departmentMail', { replace: true })}
            onTasksChanged={refreshRoomTasks}
          />
        )}
        {screen === 'departmentMail' && room && room.isChief && (
          <DepartmentMailScreen room={room} onTasksChanged={refreshRoomTasks} />
        )}
        {screen === 'archive' && room && (
          <ArchiveScreen room={room} onTasksChanged={refreshRoomTasks} />
        )}
        {screen === 'exchange' && room && <ExchangeScreen room={room} />}
      </main>

      {taskTypesOpen && room?.isChief && (
        <RoomLabelsSettings
          types={taskTypes}
          onClose={() => setTaskTypesOpen(false)}
          onSaved={() => {
            refreshTaskTypes()
            refreshRoomTasks()
          }}
        />
      )}
    </div>
  )
}
