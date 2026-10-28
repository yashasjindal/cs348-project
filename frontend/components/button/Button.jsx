import React from 'react'

function Button(text, disabled, color = '#28734F', text_color = '#FFFCF2', disabled = false, onClick) {
    const buttonStyle = {
        backgroundColour: color,
        color: text_color
    }
  return (
    <button
        disable={disabled}
        onClick={onClick}
        style={buttonStyle}
    >{{ text }}</button>
  )
}

export default Button