/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { observer } from 'mobx-react';
import type { ReactNode } from 'react';
import { BackButton } from './BackButton.js';
import { headerStyles } from './controlStyles.js';

export interface HeaderProps {
  backClassName?: string;
  backTo?: string;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
  contentClassName?: string;
  divider?: boolean;
  sideEffect?: () => void;
  title?: string;
  titleClassName?: string;
}

/** Shared panel heading with the original title focus target, navigation and content placement. */
export const Header = observer(function Header({
  backClassName,
  backTo,
  children,
  className,
  icon,
  contentClassName,
  divider,
  sideEffect,
  title,
  titleClassName,
}: HeaderProps) {
  const styles = headerStyles(useTheme());
  return (
    <div className={className} css={[styles.container, divider && styles.divider]}>
      {backTo && (
        <BackButton
          tabIndex={0}
          className={backClassName}
          css={styles.BackButton}
          sideEffect={sideEffect}
          to={backTo}
        />
      )}
      {title && (
        <h1
          tabIndex={0}
          title={title}
          className={titleClassName}
          css={styles.title}
          data-testid="panel-title"
          aria-label={title}
        >
          {title} {icon}
        </h1>
      )}
      <div className={contentClassName} css={styles.content}>
        {children}
      </div>
    </div>
  );
});
