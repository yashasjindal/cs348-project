import React from 'react'
import './Button.css'

function Button({ text, type, disabled = false, onClick }) {
  const buttonStyles = {
    currentPage: {
      backgroundColor: "#203C34",
      color: "#FFFCF2"
  },

    notCurrentPage: {
      backgroundColor: "transparent",
      color: "#607266"
    }
  }
  return (
    <button
        className="custom-button"
        disabled={disabled}
        onClick={onClick}
        style={buttonStyles[type]}
    >{text}</button>
  )
}

export default Button