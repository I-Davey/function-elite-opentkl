import { css } from '@emotion/react';
import type { KeyboardTheme } from './types.js';
/** Retained reset, focus, cursor and selection policies used by the keyboard workspace. */
export const globalStyles = (theme: KeyboardTheme) => css`
  * {
    font-family: 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }
  html {
    overflow: hidden;
  }
  html,
  body,
  div,
  span,
  applet,
  object,
  iframe,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  blockquote,
  pre,
  a,
  abbr,
  acronym,
  address,
  big,
  cite,
  code,
  del,
  dfn,
  em,
  img,
  ins,
  kbd,
  q,
  s,
  samp,
  small,
  strike,
  strong,
  sub,
  sup,
  tt,
  var,
  b,
  u,
  i,
  center,
  dl,
  dt,
  dd,
  ol,
  ul,
  li,
  fieldset,
  form,
  label,
  legend,
  table,
  caption,
  tbody,
  tfoot,
  thead,
  tr,
  th,
  td,
  article,
  aside,
  canvas,
  details,
  embed,
  figure,
  figcaption,
  footer,
  header,
  hgroup,
  menu,
  nav,
  output,
  ruby,
  section,
  summary,
  time,
  mark,
  audio,
  video {
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    font: inherit;
    vertical-align: baseline;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  a,
  abbr,
  acronym,
  address,
  big,
  small,
  strike,
  strong,
  sub,
  sup,
  b,
  u,
  i,
  center,
  th,
  td,
  button,
  img {
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  article,
  aside,
  details,
  figcaption,
  figure,
  footer,
  header,
  hgroup,
  menu,
  nav,
  section {
    display: block;
  }
  body {
    line-height: 1;
    height: 100%;
  }
  ol,
  ul {
    list-style: none;
  }
  blockquote,
  q {
    quotes: none;
  }
  blockquote:before,
  blockquote:after,
  q:before,
  q:after {
    content: '';
    content: none;
  }
  table {
    border-collapse: collapse;
    border-spacing: 0;
  }
  a {
    color: inherit;
    text-decoration: inherit;
  }
  html {
    font-family: 'Segoe UI Variable', 'Segoe UI', sans-serif;
    height: 100%;
  }
  #app {
    display: block;
    height: 100%;
    color: ${theme.body.text2.toString()};
  }
  a,
  a *,
  button,
  button *,
  label,
  label * {
    cursor: pointer;
  }
  input[type='text'],
  input[type='password'],
  textarea {
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
  }
  :focus-visible {
    outline-color: ${theme.body.primary.toString()} !important;
    outline-style: solid !important;
    outline-width: 3px !important;
    outline-offset: -3px !important;
  }
  input[type='text']:focus-visible,
  textarea:focus-visible {
    outline: none !important;
  }
  *,
  *::after,
  *::before {
    user-select: none;
    -webkit-user-select: none;
    -webkit-user-drag: none;
    cursor: default;
  }
  label: globalStyles-globalStyles;
`;
