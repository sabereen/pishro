import type { JsonValue } from '../../shared/models'

export function jsonValue<T>(value: T): JsonValue<T> {
  return JSON.parse(JSON.stringify(value)) as JsonValue<T>
}
