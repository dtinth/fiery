import * as React from 'react'
import * as firebase from 'firebase'

type DataState<T> =
  | { _status: '🕓' }
  | { _status: '💢'; _error: Error; _retry: () => any }
  | { _status: '😀'; _data: T }

export class Auth extends React.Component<{
  children: (userState: DataState<firebase.User>) => React.ReactNode
}> {
  private unsubscribe: () => any = () => {}

  auth = firebase.auth()
  state = { userState: { _status: '🕓' } as DataState<firebase.User> }
  observe() {
    this.unsubscribe = this.auth.onAuthStateChanged(
      user => {
        this.setState({ userState: { _status: '😀', _data: user } })
      },
      error => {
        this.setState({
          userState: {
            _status: '💢',
            _error: (error as any) as Error,
            _retry: () => this.observe()
          } as DataState<firebase.User>
        })
      }
    )
  }
  componentDidMount() {
    this.observe()
  }
  componentWillUnmount() {
    this.unsubscribe()
  }
  render() {
    return this.props.children(this.state.userState)
  }
}

type DataProps = {
  dataRef: firebase.database.Reference
  children: (dataState: DataState<any>) => React.ReactNode
}

export class Data extends React.Component<DataProps> {
  private dataRef?: firebase.database.Reference
  private loaded = false
  state = { dataState: { _status: '🕓' } as DataState<any> }
  componentDidMount() {
    this.setDataRef(this.props.dataRef)
  }
  setDataRef(ref: firebase.database.Reference) {
    if (this.dataRef) {
      this.dataRef.off('value', this.onUpdate)
    }
    this.dataRef = ref
    this.loaded = false
    this.dataRef.on('value', this.onUpdate, this.onError)
    if (!this.loaded) {
      this.setState({ dataState: { _status: '🕓' } as DataState<any> })
    }
  }
  componentWillUnmount() {
    if (this.dataRef) {
      this.dataRef.off('value', this.onUpdate)
    }
  }
  componentDidUpdate(prevProps: DataProps) {
    if (!this.props.dataRef.isEqual(prevProps.dataRef)) {
      this.setDataRef(this.props.dataRef)
    }
  }
  onUpdate = (snapshot: firebase.database.DataSnapshot | null) => {
    this.loaded = true
    this.setState({
      dataState: {
        _status: '😀',
        _data: snapshot && snapshot.val()
      } as DataState<any>
    })
  }
  onError = (error: Error) => {
    this.loaded = false
    this.setState({
      dataState: {
        _status: '💢',
        _error: error,
        _retry: () => this.setDataRef(this.props.dataRef)
      }
    })
  }
  render() {
    return this.props.children(this.state.dataState)
  }
}

export function unwrap<V, T = React.ReactNode>(
  state: DataState<V>,
  spec: {
    completed: (v: V) => T
    loading: () => T
    error: (error: Error, retry: () => any) => T
  }
): T {
  switch (state._status) {
    case '🕓':
      return spec.loading()
    case '💢':
      return spec.error(state._error, state._retry)
    case '😀':
      return spec.completed(state._data)
  }
}

export default { Auth, Data, unwrap }
