window.UI = (function() {
  function Button({ children, onClick }) {
    return (
      <a
        className="f6 link dim br2 ph3 pv2 dib white bg-dark-blue"
        href="javascript://"
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  function ErrorMessage({ error, retry }) {
    return (
      <div className="pa2 bg-washed-red br2 dark-red">
        <strong className="dark-red">Something went wrong!</strong>{' '}
        {String(error)}
        {!!retry && (
          <div>
            <Button onClick={retry}>Retry</Button>
          </div>
        )}
      </div>
    )
  }

  function Loading({ message }) {
    return (
      <div className="pulsate">
        <em>{message}</em>
      </div>
    )
  }

  function AuthenticationWall({ onSignIn }) {
    return (
      <div className="pa3 tc bg-white-10">
        <strong className="db mb2">Sign in to write on this guestbook</strong>
        <Button onClick={onSignIn}>Sign in with GitHub</Button>
      </div>
    )
  }

  function NavBar({ title, children }) {
    return (
      <nav className="dt w-100 border-box pa2 ph3 bg-purple">
        <a className="dtc v-mid white-60 link dim w-25" href="#" title="Home">
          {title}
        </a>
        <div className="dtc v-mid w-75 tr">{children}</div>
      </nav>
    )
  }

  NavBar.Item = function NavBarItem({ label, onClick, disabled, title }) {
    if (disabled) {
      return <span className="white-40 f6 f5-ns dib ml3">{label}</span>
    }
    return (
      <a
        className="link dim white-70 f6 f5-ns dib ml3"
        href="javascript://"
        title={title}
        onClick={onClick}
      >
        {label}
      </a>
    )
  }

  function EntryList({ children }) {
    return <div className="pa3 bg-black-50">{children}</div>
  }
  EntryList.Item = function EntryListItem({ text, name }) {
    return (
      <div>
        <strong>{name}: </strong>
        {text}
      </div>
    )
  }

  function GuestbookInputField() {
    return (
      <div className="cf">
        <input
          className="f6 f5-l input-reset bn fl black-80 bg-white pa3 lh-solid w-100 w-75-m w-80-l br2-ns br--left-ns sans-serif"
          placeholder="What’s on your mind?"
          type="text"
          name="text"
        />
        <input
          className="f6 f5-l button-reset fl pv3 tc bn bg-animate bg-black-70 hover-bg-black white pointer w-100 w-25-m w-20-l br2-ns br--right-ns sans-serif"
          type="submit"
          name="submitButton"
          value="Send"
        />
      </div>
    )
  }
  function EntryForm({ onSend }) {
    return (
      <form
        className="bg-white-10 pa3"
        onSubmit={e => {
          e.preventDefault()
          const input = e.target.text
          const text = input.value
          input.value = ''
          onSend(text).catch(e => window.alert(`Error: ${e}`))
        }}
      >
        <GuestbookInputField />
      </form>
    )
  }

  return {
    Button,
    ErrorMessage,
    Loading,
    AuthenticationWall,
    NavBar,
    EntryList,
    EntryForm
  }
})()
