import type { EmployeeProfile, Room } from './types'

export function profilesFromRoom(room: Room): EmployeeProfile[] {
  return Object.entries(room.state.employees)
    .map(([key, emp]) => ({
      key,
      name: emp.name,
      role: emp.role,
      isChief: key === room.state.chief_pc,
      hasPassword: Boolean(emp.password?.salt && emp.password?.hash)
    }))
    .sort((a, b) => {
      if (a.isChief !== b.isChief) return a.isChief ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })
}
