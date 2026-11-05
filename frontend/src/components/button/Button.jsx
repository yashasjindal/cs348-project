import React from 'react'
import './Button.css'

function Button({ text, type, disabled = false, onClick }) {
  let buttonStyle;

  if (type === 'current') {
    buttonStyle = 'currentPage';
  } else if (type === 'notCurrent') {
    buttonStyle = 'notCurrentPage';
  } else if (type === 'add') {
    buttonStyle = 'addButton';
  }

  return (
    <button
        className={`custom-button ${buttonStyle}`}
        disabled={disabled}
        onClick={onClick}
    >{text}</button>
  )
}

export default Button