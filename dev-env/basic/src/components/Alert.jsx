import React from 'react'
import t from 'prop-types'
//@ts-ignore do not remove this to get live-reloading from changes made in packages
import ChangesWhenAPackageSourceIsEdited from '../last-change-timestamp' // eslint-disable-line no-unused-vars

const kinds = {
  info: '#5352ED',
  positive: '#2ED573',
  negative: '#FF4757',
  warning: '#FFA502',
}

const AlertStyled = ({ children, kind, ...rest }) => (
  <div
    style={{
      padding: 20,
      borderRadius: 3,
      color: 'white',
      background: kinds[kind],
    }}
    {...rest}
  >
    {children}
  </div>
)

export const Alert = props => <AlertStyled {...props} />

Alert.propTypes = {
  kind: t.oneOf(['info', 'positive', 'negative', 'warning']),
  okok: t.string,
  margin: t.oneOfType([t.number, t.string]),
  marginTop: t.oneOfType([t.number, t.string]),
  marginBottom: t.oneOfType([t.number, t.string]),
  marginLeft: t.oneOfType([t.number, t.string]),
  marginRight: t.oneOfType([t.number, t.string]),
  marginX: t.oneOfType([t.number, t.string]),
  marginY: t.oneOfType([t.number, t.string]),
}

Alert.defaultProps = {
  kind: 'info',
}
