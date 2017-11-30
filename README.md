# fiery 🔥

Some components to make it easy to use Firebase with React.


## Installation

You can install fiery from npm:

```
npm install --save fiery
```


## Demo

[Try it out!](https://dtinth.github.io/fiery/#GuestbookApp)

<!-- scripts -->

```js
// Demo: GuestbookApp
// This demo app uses only Stateless Functional Components!
function GuestbookApp () {
  return (
    <section>
      <Nav />
      <GuestbookList />
      <GuestbookForm />
    </section>
  )
}

// The navigation bar
function Nav () {
  return (
    <UI.NavBar title='My Guestbook'>
      <UI.NavBar.Item label='Contact' />
      {/* Subscribe to the authentication state */}
      <fiery.Auth>
        {/* Data is represented in 3 states: 'loading', 'completed' and 'error'.
            Use `fiery.unwrap` to handle all these 3 cases. */}
        {(authState) => fiery.unwrap(authState, {
          loading: () =>
            <UI.NavBar.Item label='Checking auth…' disabled />,
          completed: (user) =>
            user ? (
              <UI.NavBar.Item
                label={'Sign Out (' + user.displayName + ')'}
                onClick={signOut}
              />
            ) : (
              <UI.NavBar.Item
                label='Sign in with GitHub'
                onClick={signIn}
              />
            ),
          error: (error, retry) =>
            <UI.NavBar.Item
              label='Auth checking failed'
              title={String(error) + ' (click to retry)'}
              onClick={retry}
            />
        })}
      </fiery.Auth>
    </UI.NavBar>
  )
}

// The `signIn` and `signOut` functions uses the normal Firebase auth functions.
// No new APIs to learn here!
function signIn () {
  firebase.auth().signInWithPopup(new firebase.auth.GithubAuthProvider())
    .catch(e => window.alert(`Sorry, cannot sign in! ${e}`))
}
function signOut () {
  if (window.confirm('RLY SIGN OUT?')) firebase.auth().signOut()
}

// The guestbook entry list.
function GuestbookList () {
  const dataRef = firebase.database()
    .ref('demos/guestbook')
    .orderByKey()
    .limitToLast(8)

  return (
    <UI.EntryList>
      {/* Subscribe to Firebase Realtime Database */}
      <fiery.Data dataRef={dataRef}>
        {(guestbookState) => fiery.unwrap(guestbookState, {
          loading: () =>
            <UI.Loading message='Loading messages…' />,
          completed: (guestbook) =>
            Object.keys(guestbook).map(key =>
              <UI.EntryList.Item
                key={key}
                text={guestbook[key].text}
                name={guestbook[key].name}
              />
            ),
          error: (error) =>
            <UI.ErrorMessage error={error} retry={retry} />
        })}
      </fiery.Data>
    </UI.EntryList>
  )
}

// The form to submit a guestbook entry.
function GuestbookForm () {
  return (
    <fiery.Auth>
      {userState => fiery.unwrap(userState, {
        loading: () =>
          <UI.Loading message='Checking authentication status…' />,
        completed: (user) =>
          user ? (
            <UI.EntryForm onSend={(text) => submitForm(text, user)} />
          ) : (
            <UI.AuthenticationWall onSignIn={signIn} />
          ),
        error: (error) =>
          <UI.ErrorMessage error={error} retry={retry} />
      })}
    </fiery.Auth>
  )
}

// Write to Firebase Realtime Database using the familiar Firebase SDK APIs!
function submitForm (text, user) {
  firebase.database().ref('demos/guestbook').push({
    time: firebase.database.ServerValue.TIMESTAMP,
    name: user.displayName,
    text: text
  })
}

// Render the app..
ReactDOM.render(<GuestbookApp />, document.getElementById('GuestbookApp'))
```




## API Usage

### `fiery.unwrap` — Working with remote data states

Data from Firebase is wrapped in a `RemoteDataState` object, which can represent 3 states:

- **loading** — when data is being fetched.
- **completed** — when data is available.
- **error** — when data cannot be fetched.

Use the `fiery.unwrap()` function to unwrap it. It accepts 2 arguments:

- `state` — The `RemoteDataState` object to unwrap.
- `spec` — An **object** specifying how to unwrap this object in each state. Should contain 3 methods:
  - `loading()` — for **loading** state
  - `completed(data)` — for **completed** state
  - `error(error, retry)` — for **error** state

```js
// Example: Unwrapping a RemoteDataState into a React element.
fiery.unwrap(dataState, {
  loading: () =>
    <div>Loading data…</div>,
  completed: (data) =>
    <div>Data is {JSON.stringify(data)}</div>,
  error: (error, retry) =>
    <ErrorMessage error={error} retry={retry} />
})
```


### `fiery.Auth` — Subscribe to authentication state

Takes a single prop:

- `children` — A **function** that determines how the authentication state should be rendered.
  Will be called with a `RemoteDataState` wrapping a [`firebase.User`](https://firebase.google.com/docs/reference/js/firebase.User) object (if signed in) or `null` (if signed out).


### `fiery.Data` — Subscribe to Realtime Database

Takes two props:

- `dataRef` — A [`firebase.database.Reference`](https://firebase.google.com/docs/reference/js/firebase.database.Reference) representing the data reference to fetch.
- `children` — A **function** that determines how the data state should be rendered.
  Will be called with a `RemoteDataState` wrapping the data.


## Development

This project uses Yarn.


### Dependencies

To install dependencies, run:

```
yarn
```


### Development

Run:

```
yarn dev
```

This will run Rollup in watch mode and generate `umd/fiery.js`.
It will also re-generate the documentation site on change.


### Building

To build the library once, run:

```
yarn build
```

This will generate `umd/fiery.js`.


### Docs

The documentation website is generated from `README.md`.

To generate the docs, run:

```
yarn docs
```


## License

MIT.
