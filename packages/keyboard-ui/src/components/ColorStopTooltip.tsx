/** @jsxImportSource @emotion/react */
import { ClassNames, useTheme } from '@emotion/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip.js';
import { InfoIcon } from './icons/InfoIcon.js';
import { colorStopTooltipStyles } from './advancedColorStyles.js';

export function ColorStopTooltipContent() {
  const { t } = useTranslation(['common']);
  return <div>{t('common:colorStopTooltip')}</div>;
}
/** Any ancestor scroll closes stop help, retaining the fixed popup and original icon styling. */
export function ColorStopTooltip({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const styles = colorStopTooltipStyles(useTheme());
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          strategy="fixed"
          placement="right-start"
          offset={[-16, 20]}
          innerClassName={css(styles.innerClassName)}
          onRequestClose={() => setOpen(false)}
          open={open}
          tooltip={<ColorStopTooltipContent />}
        >
          <InfoIcon onClick={() => setOpen(!open)} css={[styles.infoIcon, open && styles.open]} />
        </Tooltip>
      )}
    </ClassNames>
  );
}
