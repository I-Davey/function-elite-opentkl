/** @jsxImportSource @emotion/react */
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router';
import { PrimaryShimlessButton } from './Button.js';
import { AngleLeftIcon } from './icons/AngleLeftIcon.js';
import { backButtonStyles } from './controlStyles.js';

export interface BackButtonProps {
  to?: string;
  sideEffect?: () => void;
  showText?: boolean;
  className?: string;
  tabIndex?: number;
}

/** Navigate first, then invoke the caller's side effect; absent destination uses history back. */
export function BackButton({
  to,
  sideEffect,
  showText = true,
  className,
  tabIndex,
}: BackButtonProps) {
  const history = useHistory(),
    { t } = useTranslation('common'),
    styles = backButtonStyles();
  return (
    <PrimaryShimlessButton
      tabIndex={tabIndex}
      className={className}
      css={styles.container}
      data-testid="back-button"
      onClick={() => {
        if (to) history.push(to);
        else history.goBack();
        sideEffect?.();
      }}
    >
      <AngleLeftIcon css={styles.icon} />
      {showText && t('back')}
    </PrimaryShimlessButton>
  );
}
