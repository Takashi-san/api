/**
 * @prettier
 */
type Primitive = boolean | string | number

export interface Data {
  [K: string]: ValidDataValue
}

export type ValidDataValue = Primitive | null | Data

export interface Ack {
  err: string | undefined
}

type ListenerSoul = {
  '#': string
}

export type ListenerObj = Record<string, ListenerSoul | Primitive | null> & {
  _: ListenerSoul
}

export type ListenerData = Primitive | null | ListenerObj | undefined

export type Listener = (data: ListenerData, key: string) => void
export type Callback = (ack: Ack) => void

export interface Soul {
  get: string | undefined
  put: Primitive | null | object | undefined
}

export interface UserSoul extends Soul {
  sea?: string
}

export interface GUNNode {
  _: Soul
  get(key: string): GUNNode
  map(): GUNNode
  put(data: ValidDataValue | GUNNode, cb?: Callback): void
  on(this: GUNNode, cb: Listener): void
  once(this: GUNNode, cb?: Listener): GUNNode
  set(data: ValidDataValue | GUNNode, cb?: Callback): GUNNode
  off(): void
  user(): UserGUNNode
  user(epub: string): GUNNode
}

export interface UserGUNNode extends GUNNode {
  _: UserSoul
  auth(user: string, pass: string, cb: Callback): void
  is?: {
    pub: string
  }
  create(user: string, pass: string, cb: Callback): void
  leave(): void
}
