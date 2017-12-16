import React from 'react'
import firebase from 'firebase'

type DataState<T> =
  { _status: '🕓' } |
  { _status: '💢', _error: Error, _retry: () => any } |
  { _status: '😀', _data: T }

export class Auth extends React.Component {
  private unsubscribe: () => any

  auth = firebase.auth()
  state = { userState: { _status: '🕓' } }
  observe () {
    this.unsubscribe = this.auth.onAuthStateChanged(
      user => {
        this.setState({ userState: { _status: '😀', _data: user } })
      },
      error => {
        this.setState({
          userState: { _status: '💢', _error: error, _retry: () => this.observe() }
        })
      }
    )
  }
  componentDidMount () {
    this.observe()
  }
  componentWillUnmount () {
    this.unsubscribe()
  }
  render () {
    return this.props.children(this.state.userState)
  }
}

export class Data extends React.Component {
  private dataRef: any
  state = { dataState: { _status: '🕓' } }
  componentDidMount () {
    this.setDataRef(this.props.dataRef)
  }
  setDataRef (ref) {
    if (this.dataRef) {
      this.dataRef.off('value', this.onUpdate)
    }
    this.dataRef = ref
    this.dataRef.on('value', this.onUpdate, this.onError)
    this.setState({ dataState: { _status: '🕓' } })
  }
  componentWillUnmount () {
    this.dataRef.off('value', this.onUpdate)
  }
  componentWillReceiveProps (nextProps) {
    if (!nextProps.dataRef.isEqual(this.props.dataRef)) {
      this.setDataRef(nextProps.dataRef)
    }
  }
  onUpdate = (snapshot) => {
    this.setState({ dataState: { _status: '😀', _data: snapshot.val() } })
  }
  onError = (error) => {
    this.setState({ dataState: { _status: '💢', _error: error, _retry: () => this.setDataRef(this.dataRef) } })
  }
  render () {
    return this.props.children(this.state.dataState)
  }
}

export function unwrap<V,T> (state: DataState<V>, spec: {
  completed: (v: V) => T,
  loading: () => T,
  error: (error: Error, retry: () => any) => T
}): T {
  switch (state._status) {
    case '🕓': return spec.loading()
    case '💢': return spec.error(state._error, state._retry)
    case '😀': return spec.completed(state._data)
  }
}

export default { Auth, Data, unwrap }
