import React from 'react'
import './Button.css'

function Button({ text, color = '#28734F', text_color = '#FFFCF2', disabled = false, onClick }) {
    const buttonStyle = {
        backgroundColor: color,
        color: text_color,
    }
  return (
    <button
        className="custom-button"
        disabled={disabled}
        onClick={onClick}
        style={buttonStyle}
    >{text}</button>
  )
}

export default Button