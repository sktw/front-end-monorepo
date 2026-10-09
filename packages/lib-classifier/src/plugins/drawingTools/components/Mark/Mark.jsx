import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { forwardRef, useEffect, useEffectEvent, useRef } from 'react';
import styled, { css, useTheme } from 'styled-components'
import draggable from '../draggable'

export const STROKE_WIDTH = 2
export const SELECTED_STROKE_WIDTH = 4

const StyledGroup = styled.g`
  stroke-width: ${STROKE_WIDTH}px;

  &.active {
    stroke-width: ${SELECTED_STROKE_WIDTH}px;
  }

  &:focus {
    outline: none;
  }
  
  &:focus-visible {
    ${(props) =>
    css`
        outline: solid medium ${props.focusColor};
      `}
  }

  &[aria-disabled="false"]:hover {
    ${(props) =>
    props.dragging
      ? css`
            cursor: grabbing;
          `
      : css`
            cursor: grab;
          `}
  }
`

function useChange(value, callback) {
  // run callback as an effect event only when value changes
  // do not run callback on initial render
  const onChange = useEffectEvent(callback)
  const valueRef = useRef(value)

  useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value
      onChange(value)
    }
  }, [value])
}

export function focusMark(markNode) {
  const hasFocus = markNode === document.activeElement
  if (!hasFocus) {
    const x = scrollX
    const y = scrollY
    markNode?.focus()
    window.scrollTo(x, y)
  }
}

function defaultHandler() {
  return true
}

const Mark = forwardRef(function Mark(
  {
    children,
    disabled = false,
    dragging = false,
    isActive = false,
    label,
    mark,
    onDelete = defaultHandler,
    onFinish = defaultHandler,
    onSelect = defaultHandler,
    pointerEvents = 'painted',
  },
  ref
) {
  const theme = useTheme()
  const markRoot = ref ?? useRef()
  const { tool } = mark
  const mainStyle = {
    color: tool?.color ?? 'green',
    fill: 'transparent',
    stroke: tool?.color ?? 'green'
  }
  const focusColor = theme?.global.colors[theme?.global.colors.focus]

  function openSubTaskPopup() {
    if (!mark.subTaskVisibility) {
      const markBounds = markRoot.current?.getBoundingClientRect()
      mark.setSubTaskVisibility(true, markBounds)
    }
  }

  useChange(mark.finished, finished => {
    // mark.finished should only change for active marks
    // mark.finished should only change from false -> true
    if (!(isActive && finished)) {
      console.error('Failure of mark invariant')
      return
    }

    // Set focus on the mark even if the mark uses subtasks.
    // This ensures that grommet's Layer will try to set focus on the mark
    // when the popup task modal closes.
    // Note that this may fail if there are multiple active marks
    // e.g. in the separate frames viewer.

    focusMark(markRoot.current)

    if (mark.usesSubTasks) {
      openSubTaskPopup()
    }
  })

  // This effect is not needed to set focus when the subtask popup closes because
  // grommet's Layer component does this by default.
  // However, to keep scroll management consistent, we call focusMark here.
  // grommet calls focus inside a timeout, so this will override it by running first.

  useChange(mark.subTaskVisibility, subTaskVisibility => {
    if (!subTaskVisibility) {
      focusMark(markRoot.current)
    }
  })

  function onKeyDown(event) {
    switch (event.key) {
      case 'Backspace': {
        event.preventDefault()
        event.stopPropagation()
        onDelete(mark)
        return false
      }
      case ' ':
      case 'Enter': {
        event.preventDefault()
        event.stopPropagation()
        onSelect(mark)
        openSubTaskPopup()
        onFinish(event)
        return false
      }
      default: {
        return true
      }
    }
  }

  function onPointerUp() {
    // When drawing with the polygon tool (mark.finished = false) this handler will run if the user
    // clicks the undo button. This leads to the following bugs:
    // 1. The popup will open.
    // 2. The mark gains focus. If the user subsequently presses
    // enter, the popup opens and the mark is left in an invalid state.

    if (!mark.finished) {
      return
    }

    // focus the mark, if it isn't already focused.
    focusMark(markRoot.current)
    if (mark.usesSubTasks) {
      openSubTaskPopup()
    }
  }

  function onFocus() {
    onSelect(mark)
  }

  let transform = ''
  transform =
    mark.x && mark.y
      ? `${transform} translate(${mark.x}, ${mark.y})`
      : transform

  if (mark.angle) {
    const rotateTransform =
      mark.x_rotate && mark.y_rotate
        ? `rotate(${mark.angle}, ${mark.x_rotate}, ${mark.y_rotate})`
        : `rotate(${mark.angle})`

    transform = `${transform} ${rotateTransform}`
  }

  return (
    <StyledGroup
      {...mainStyle}
      id={`mark-${mark.id}`}
      data-testid="mark-mark"
      aria-disabled={disabled ? 'true' : 'false'}
      aria-label={label}
      className={`drawingMark ${isActive ? 'active' : ''}`}
      dragging={dragging}
      focusable
      focusColor={focusColor}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPointerUp={onPointerUp}
      pointerEvents={pointerEvents}
      ref={markRoot}
      role='button'
      tabIndex={disabled ? -1 : 0}
      transform={transform}
    >
      {children}
    </StyledGroup>
  )
})

Mark.propTypes = {
  disabled: PropTypes.bool,
  dragging: PropTypes.bool,
  children: PropTypes.node.isRequired,
  isActive: PropTypes.bool,
  label: PropTypes.string.isRequired,
  mark: PropTypes.shape({
    angle: PropTypes.number,
    finished: PropTypes.bool,
    id: PropTypes.string.isRequired,
    isValid: PropTypes.bool,
    setSubTaskVisibility: PropTypes.func.isRequired,
    subTaskVisibility: PropTypes.bool,
    tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
    tool: PropTypes.shape({
      color: PropTypes.string
    }),
    usesSubTasks: PropTypes.bool,
    x: PropTypes.number,
    x_rotate: PropTypes.number,
    y: PropTypes.number,
    y_rotate: PropTypes.number
  }).isRequired,
  onDelete: PropTypes.func,
  onFinish: PropTypes.func,
  onSelect: PropTypes.func,
  pointerEvents: PropTypes.string,
  tool: PropTypes.shape({
    color: PropTypes.string
  })
}

export default draggable(observer(Mark))
export { Mark }
