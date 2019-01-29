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

function receiveError(
  error: Error,
  retry: () => void
): <T>(oldState: DataState<T>) => DataState<T> {
  return oldState => ({
    loading: false,
    failed: true,
    error: error,
    data: oldState.data,
    retry
  })
}

function retryBegin<T>(oldState: DataState<T>): DataState<T> {
  if (oldState.failed) {
    return {
      loading: true,
      failed: true,
      error: oldState.error,
      data: oldState.data
    }
  } else {
    return {
      loading: true,
      failed: false,
      data: oldState.data
    }
  }
}

export function useFirebaseAuth() {
  const [auth] = React.useState(() => firebase.auth())
  const [retryCount, setRetryCount] = React.useState(() => 0)
  const [authState, setAuthState] = React.useState<
    DataState<firebase.User | null>
  >(() => {
    return auth.currentUser
      ? { loading: false, failed: false, data: auth.currentUser }
      : { loading: true, failed: false, data: auth.currentUser }
  })
  React.useEffect(
    () => {
      return auth.onAuthStateChanged(
        user => {
          setAuthState({ loading: false, failed: false, data: user })
        },
        error => {
          const retry = () => {
            setAuthState(retryBegin)
            setRetryCount(c => c + 1)
          }
          setAuthState(receiveError((error as any) as Error, retry))
        }
      )
    },
    [retryCount]
  )
  return authState
}

type TestInterface = {
  simulateError?: (error: Error) => void
}

export function useFirebaseDatabase(
  query: firebase.database.Query,
  refTestInterface?: (testInterface: TestInterface | null) => void
): DataState<any> & Suspensible<any> {
  const suspenseErrorRef = React.useRef<Error | null>(null)
  const [testInterface] = React.useState<TestInterface>(() => ({}))
  const [dataState, setDataState] = React.useState<DataState<any>>(() => {
    return { loading: true, failed: false }
  })
  const [retryCount, setRetryCount] = React.useState(() => 0)
  const identifier = getDatabaseQueryIdentifier(query)
  React.useEffect(
    () => {
      let unsubscribed = false
      const subscriber = (snapshot: firebase.database.DataSnapshot | null) => {
        if (unsubscribed) return
        setDataState({
          loading: false,
          failed: false,
          data: snapshot && snapshot.val()
        })
      }
      const onError = (e: Error) => {
        const retry = () => {
          setDataState(retryBegin)
          setRetryCount(c => c + 1)
        }
        setDataState(receiveError(e, retry))
      }
      query.on('value', subscriber, onError)
      testInterface.simulateError = e => onError(e)
      return () => {
        unsubscribed = true

        // Wait a bit before actually unsubscribing, to keep cached data.
        setTimeout(() => {
          query.off('value', subscriber)
        })
      }
    },
    [identifier, retryCount]
  )
  React.useEffect(
    () => {
      if (refTestInterface) refTestInterface(testInterface)
      return () => {
        if (refTestInterface) refTestInterface(null)
      }
    },
    [refTestInterface]
  )
  function read() {
    if (suspenseErrorRef.current) {
      throw suspenseErrorRef.current
    }
    let readValue: any
    let read: boolean = false
    let onRead: () => void
    const callback = (snapshot: firebase.database.DataSnapshot | null) => {
      read = true
      readValue = snapshot && snapshot.val()
      setTimeout(() => query.off('value', callback))
      if (onRead) onRead()
    }
    const onError = (error: Error) => {
      suspenseErrorRef.current = error
      setTimeout(() => query.off('value', callback))
      if (onRead) onRead()
    }
    query.on('value', callback, onError)
    if (read) return readValue
    throw new Promise(resolve => (onRead = resolve))
  }
  return { ...dataState, unstable_read: read }
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

function getDatabaseQueryIdentifier(
  query: firebase.database.Query & { queryIdentifier?: () => string }
) {
  return [
    query.toString(),
    query.queryIdentifier && query.queryIdentifier()
  ].join('?')
}

export default { useFirebaseAuth, useFirebaseDatabase, Auth, Data }
