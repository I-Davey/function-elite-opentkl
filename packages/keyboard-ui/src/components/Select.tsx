/** @jsxImportSource @emotion/react */
import { useTheme } from '@emotion/react';
import ReactSelect, {
  components,
  type Props,
  type GroupBase,
  type DropdownIndicatorProps,
  type OptionProps,
} from 'react-select';
import { ArrowSelectMenuIcon } from './icons/ArrowSelectMenuIcon.js';
import { getPrimaryStyles, getSecondaryStyles } from './selectStyles.js';
import { zIndex } from '../theme/layers.js';
import { slugify } from '../logic/slugify.js';

/** Custom indicator used by the base select unless caller components override it. */
export function DropdownIndicator<Option, Multi extends boolean, Group extends GroupBase<Option>>(
  props: DropdownIndicatorProps<Option, Multi, Group>,
) {
  return (
    <components.DropdownIndicator {...props}>
      <ArrowSelectMenuIcon css={props.getStyles('dropdownIndicator', props)} />
    </components.DropdownIndicator>
  );
}

/** Retained truncated option label/title and stable profile-option test identity. */
export function TooltipOption<Option, Multi extends boolean, Group extends GroupBase<Option>>(
  props: OptionProps<Option, Multi, Group>,
) {
  return (
    <components.Option {...props}>
      <span
        title={props.label}
        data-testid={`profile-option-${slugify(props.label)}`}
        css={{
          label: 'Component-optionText',
          overflow: 'hidden',
          display: 'inline-block',
          textOverflow: 'ellipsis',
          width: props.isSelected ? 'calc(100% - 4px)' : '100%',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {props.children}
      </span>
    </components.Option>
  );
}

/** Normal react-select props/types; callbacks always use the latest caller values.
 * Multi-select is forwarded unchanged rather than dropped by the recovered wrapper.
 */
export function Select<
  Option = unknown,
  Multi extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({ styles, ...props }: Props<Option, Multi, Group>) {
  const theme = useTheme();
  return (
    <ReactSelect<Option, Multi, Group>
      tabIndex={0}
      menuPlacement="bottom"
      menuPosition="fixed"
      components={{ DropdownIndicator }}
      styles={styles || getPrimaryStyles<Option, Multi, Group>(theme)}
      {...props}
    />
  );
}

export type ThemedSelectProps<
  Option = unknown,
  Multi extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Props<Option, Multi, Group> & {
  modal?: boolean;
  tooltip?: boolean;
};

/** Primary control with retained portal placement and caller override precedence. */
export function PrimarySelect<
  Option = unknown,
  Multi extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({
  isSearchable,
  isMulti,
  modal,
  tooltip,
  components: customComponents,
  ...props
}: ThemedSelectProps<Option, Multi, Group>) {
  const theme = useTheme();
  return (
    <Select<Option, Multi, Group>
      menuPortalTarget={modal ? document.body : document.getElementById('app')}
      isMulti={isMulti}
      styles={{
        ...getPrimaryStyles<Option, Multi, Group>(theme),
        ...(modal
          ? { menuPortal: (base) => ({ ...base, zIndex: zIndex('selectionInModal') }) }
          : {}),
      }}
      isSearchable={!!isSearchable}
      components={tooltip ? { Option: TooltipOption } : customComponents}
      {...props}
    />
  );
}

/** Secondary appearance uses the same select implementation and native option contracts. */
export function SecondarySelect<
  Option = unknown,
  Multi extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({
  isSearchable,
  modal,
  tooltip,
  components: customComponents,
  ...props
}: ThemedSelectProps<Option, Multi, Group>) {
  const theme = useTheme();
  return (
    <Select<Option, Multi, Group>
      tabIndex={0}
      menuPortalTarget={modal ? document.body : document.getElementById('app')}
      styles={{
        ...getSecondaryStyles<Option, Multi, Group>(theme),
        ...(modal
          ? { menuPortal: (base) => ({ ...base, zIndex: zIndex('selectionInModal') }) }
          : {}),
      }}
      isSearchable={!!isSearchable}
      components={tooltip ? { Option: TooltipOption } : customComponents}
      {...props}
    />
  );
}
