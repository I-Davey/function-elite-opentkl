/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { AnimateHeight } from '../../components/AnimateHeight.js';
import { AngleDownIcon } from '../../components/icons/AngleDownIcon.js';
import { KeyboardKey } from '../../components/KeyboardKey.js';
import { targetCategoryStyles } from './remapStyles.js';
import type { RemapTargetLabel, RemapTargetProps } from './types.js';

/** Search retains prefix matching; selecting a target reserves a replaced single-key macro first. */
export const RemapTargetKeyCategory = observer(function RemapTargetKeyCategory({
  keyRemapDeviceProfile: remaps,
  selectedKey,
  selectedLevel,
  category,
  keyInfo,
  searchTerm,
}: RemapTargetProps & {
  category: string;
  keyInfo: RemapTargetLabel[];
  searchTerm: string;
}) {
  const [show, setShow] = useState(true),
    [staggered, setStaggered] = useState(true),
    [animationDone, setAnimationDone] = useState(true);
  const theme = useTheme(),
    styles = targetCategoryStyles(theme, show, selectedLevel === 1),
    { t } = useTranslation();
  useEffect(() => setStaggered(show), [show]);
  const toggle = () => {
    setShow(!show);
    setAnimationDone(false);
  };
  const select = (target: number) => {
    const { physicalKeyModel: key, keyCode, isFn } = selectedKey;
    if (key.active.kind === 'Single')
      remaps.reserveReplacedMacro(
        isFn && key.active.fnPressed !== null ? key.active.fnPressed.remapTo : key.active.remapTo,
      );
    remaps.updateSimpleRemap(keyCode, target, selectedLevel, isFn);
  };
  const search = searchTerm.toLowerCase();
  return (
    <div>
      <div
        css={styles.keyCategory}
        tabIndex={0}
        onMouseDown={toggle}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' && document.activeElement === event.currentTarget) toggle();
        }}
      >
        {t(`keyboard:targetKeyCategory-${category}`)}
        <AngleDownIcon />
      </div>
      <AnimateHeight
        duration={200}
        height={staggered ? 'auto' : 0}
        easing="ease-out"
        onAnimationEnd={() => {
          if (staggered) setAnimationDone(true);
        }}
      >
        <div
          css={styles.details}
          onMouseDown={(event) => {
            if (show) event.stopPropagation();
          }}
        >
          <div css={[styles.detailsInner, animationDone && styles.detailsInnerVisible]}>
            <div css={styles.keysWrapper}>
              {keyInfo
                .filter((info) =>
                  info.keyTerms.some(
                    (term) =>
                      term.toLowerCase().startsWith(search) ||
                      !!info.remapPrefix?.toLowerCase().startsWith(search),
                  ),
                )
                .map((info) => (
                  <div
                    key={`${info.keyCode}-${info.activationKeyText}`}
                    css={styles.key}
                    onClick={() => select(info.keyCode)}
                  >
                    <KeyboardKey
                      code={info.keyCode}
                      size={{ width: 55, height: 55 }}
                      padding={5}
                      keyInfo={{
                        ...info,
                        label: info.shortLabel ?? info.label,
                        label2: info.shortLabel2,
                      }}
                      theme={theme}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </AnimateHeight>
    </div>
  );
});
