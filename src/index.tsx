import * as React from 'react'
import * as firebase from 'firebase'

export type DataState<T> =
  | {
      loading: true
      failed: false
      error?: undefined
      data?: T
      retry?: undefined
    }
  | {
      loading: true
      failed: true
      error: Error
      data?: T
      retry?: undefined
    }
  | {
      loading: false
      failed: true
      error: Error
      data?: T
      retry: () => void
    }
  | {
      loading: false
      failed: false
      error?: undefined
      data: T
      retry?: undefined
    }

export type Suspensible<T> = {
  unstable_read: () => T
}

type DataAction =
  | { type: 'begin loading' }
  | { type: 'value'; data: any }
  | { type: 'error'; error: Error; retry: () => void }

interface DataProvider {
  cacheKey: string
  loadOnce(): Promise<any>
  subscribe(
    onNext: (value: any) => void,
    onError: (e: Error) => void
  ): {
    unsubscribe(): void
  }
}

class DataCache {
  private map = new Map<string, DataCacheEntry>()
  initialDataState: DataState<any> = { loading: true, failed: false }
  reducer(state: DataState<any>, action: DataAction): DataState<any> {
    switch (action.type) {
      case 'begin loading':
        return state.failed
          ? {
              loading: true,
              failed: true,
              error: state.error,
              data: state.data
            }
          : {
              loading: true,
              failed: false,
              data: state.data
            }
      case 'value':
        return { loading: false, failed: false, data: action.data }
      case 'error':
        return {
          failed: true,
          loading: false,
          data: state.data,
          error: action.error,
          retry: action.retry
        }
    }
    return state
  }
  getSource(provider: DataProvider): DataCacheEntry {
    const cacheKey = provider.cacheKey
    if (this.map.has(cacheKey)) {
      return this.map.get(cacheKey)!
    }
    let gone = false
    const source = new DataCacheEntry(provider, () => {
      if (gone) return
      gone = true
      this.map.delete(cacheKey)
    })
    this.map.set(cacheKey, source)
    return source
  }
}

export const _cache = new DataCache()

class DataCacheEntry {
  private pending = true
  private promise: Promise<void> | null = null
  private latestData: any = null
  private error: Error | null = null
  private onErrorSimulated: (() => void) | null = null
  private subscriberCount = 0
  constructor(public provider: DataProvider, private unregister: () => void) {}
  subscribe(dispatch: (action: DataAction) => void) {
    const onNext = (value: any) => {
      this.latestData = value
      this.pending = false
      dispatch({ type: 'value', data: this.latestData })
    }
    const onError = (e: Error) => {
      this.error = e
      this.pending = false
      dispatch({ type: 'error', error: this.error, retry })
    }
    const retry = () => {
      this.unregister()
      dispatch({ type: 'begin loading' })
    }
    this.onErrorSimulated = () => {
      dispatch({ type: 'error', error: this.error!, retry })
    }
    const subscription = this.provider.subscribe(onNext, onError)
    if (this.pending) {
      dispatch({ type: 'begin loading' })
    }
    this.subscriberCount++
    return () => {
      this.subscriberCount--
      if (!this.pending && !this.subscriberCount) {
        this.unregister()
      }
      subscription.unsubscribe()
      this.onErrorSimulated = null
    }
  }
  read() {
    if (this.pending) {
      if (!this.promise) this.promise = this.loadOnce()
      throw this.promise
    }
    if (this.error) {
      setTimeout(() => this.unregister())
      throw this.error
    }
    return this.latestData
  }
  simulateError(e: Error): void {
    this.error = e
    this.pending = false
    if (this.onErrorSimulated) this.onErrorSimulated()
  }
  private async loadOnce() {
    try {
      this.latestData = await this.provider.loadOnce()
    } catch (e) {
      this.error = e
    } finally {
      this.pending = false
    }
  }
}

type TestInterface = {
  simulateError?: (error: Error) => void
}

class FirebaseAuthProvider implements DataProvider {
  constructor() {}
  get cacheKey() {
    return 'auth'
  }
  loadOnce(): Promise<any> {
    return new Promise((resolve, reject) => {
      const auth = firebase.auth()
      let shouldUnsubscribeNow = false
      let unsubscribe: (() => void) | null = null
      const tryToUnsubscribe = () => {
        if (unsubscribe) {
          unsubscribe()
        } else {
          shouldUnsubscribeNow = true
        }
      }
      unsubscribe = auth.onAuthStateChanged(
        user => {
          resolve(user)
          tryToUnsubscribe()
        },
        error => {
          reject(error)
          tryToUnsubscribe()
        }
      )
      if (shouldUnsubscribeNow) {
        unsubscribe()
      }
    })
  }
  subscribe(
    onNext: (value: any) => void,
    onError: (e: Error) => void
  ): { unsubscribe(): void } {
    const auth = firebase.auth()
    const unsubscribe = auth.onAuthStateChanged(onNext, onError as any)
    return { unsubscribe }
  }
}

export function useFirebaseAuth(): DataState<firebase.User> &
  Suspensible<firebase.User> {
  const [dataState, dispatch] = React.useReducer(
    _cache.reducer,
    _cache.initialDataState
  )
  const source = _cache.getSource(new FirebaseAuthProvider())
  React.useEffect(() => source.subscribe(dispatch), [source])
  return {
    ...dataState,
    unstable_read: () => source.read()
  }
}

class FirebaseDatabaseProvider implements DataProvider {
  constructor(public query: firebase.database.Query) {}
  get cacheKey() {
    const query: firebase.database.Query & {
      queryIdentifier?: () => string
    } = this.query
    return [
      query.toString(),
      query.queryIdentifier && query.queryIdentifier()
    ].join('?')
  }
  async loadOnce(): Promise<any> {
    return (await this.query.once('value')).val()
  }
  subscribe(
    onNext: (value: any) => void,
    onError: (e: Error) => void
  ): { unsubscribe(): void } {
    const onValue = (snapshot: firebase.database.DataSnapshot | null) => {
      onNext(snapshot && snapshot.val())
    }
    this.query.on('value', onValue, onError)
    return {
      unsubscribe: () => {
        this.query.off('value', onValue)
      }
    }
  }
}

export function useFirebaseDatabase(
  query: firebase.database.Query,
  refTestInterface?: (testInterface: TestInterface | null) => void
): DataState<any> & Suspensible<any> {
  const [dataState, dispatch] = React.useReducer(
    _cache.reducer,
    _cache.initialDataState
  )
  const source = _cache.getSource(new FirebaseDatabaseProvider(query))
  React.useEffect(() => source.subscribe(dispatch), [source])
  ;(React as any).useImperativeHandle(
    refTestInterface,
    () => ({ simulateError: e => source.simulateError(e) } as TestInterface),
    [source]
  )
  return {
    ...dataState,
    unstable_read: () => source.read()
  }
}

export function Auth(props: {
  children: (authState: DataState<firebase.User | null>) => React.ReactNode
}) {
  const authState = useFirebaseAuth()
  return props.children(authState)
}

export function Data(props: {
  dataRef: firebase.database.Query
  children: (dataState: DataState<any>) => React.ReactNode
}) {
  const dataState = useFirebaseDatabase(props.dataRef)
  return props.children(dataState)
}

export default { useFirebaseAuth, useFirebaseDatabase, Auth, Data, _cache }
