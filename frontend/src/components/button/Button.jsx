import React from 'react'
import './Button.css'

function Button({ text, type, disabled = false, onClick, htmlType }) {
  let buttonStyle;

  if (type === 'current') {
    buttonStyle = 'currentPage';
  } else if (type === 'notCurrent') {
    buttonStyle = 'notCurrentPage';
  } else if (type === 'add') {
    buttonStyle = 'addButton';
  } else if (type === 'primary') {
    buttonStyle = 'primaryButton';
  } else if (type === 'symbol') {
    buttonStyle = 'symbolButton'
  } else if (type === 'search') {
    buttonStyle = 'searchButton'
  } else if (type === 'clear') {
    buttonStyle = 'clearButton'
  }

  return (
    <button
        className={`custom-button ${buttonStyle}`}
        type={htmlType}
        disabled={disabled}
        onClick={onClick}
    >{text}</button>
  )
}

export default Button
