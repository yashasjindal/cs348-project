import React from 'react'
import './Button.css'

function Button({ text, type, disabled = false, onClick }) {

  return (
    <button
        className={`custom-button ${type}`}
        disabled={disabled}
        onClick={onClick}
    >{text}</button>
  )
}

export default Button