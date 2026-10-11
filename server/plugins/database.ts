import { closeDatabase } from '../utils/database'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabase)
})
