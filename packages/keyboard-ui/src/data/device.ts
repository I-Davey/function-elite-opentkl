import type { KeyboardReadyDevice } from '../models/deviceTypes.js';
/** Local HE identity/capabilities seed the UI; Rust readback hydrates actual device/profile settings. */
export const defaultKeyboardDevice: KeyboardReadyDevice = {
  id: 0,
  uniqueId: 'standalone-offline-device',
  deviceType: 'FunctionEliteAnsi',
  supportedCapabilities: {
    captureCard: false,
    lightingV2: false,
    uniqueId: true,
    firmwareInfo: true,
    firmwareUpdate: true,
    mixer: false,
    volumeControl: false,
    equalizer: false,
    dtsAudio: false,
    temperature: false,
    rpm: false,
    lcd: false,
    monitoring: false,
    profile: true,
    idleTimeout: true,
    battery: false,
    physicalKeys: true,
    pollingRate: true,
    mouse: false,
    keyRemap: true,
    wireless: false,
    keyboardMouseLighting: true,
    keyLock: true,
    dtsClearvoice: false,
    lightingMic: false,
    ramLighting: false,
    deviceSpecificData: true,
  },
  capabilityData: {
    uniqueId: {
      id: 'standalone-offline-device',
    },
    physicalKeys: {
      physicalKeysLayout: {
        layout: 'ANSI',
        formFactor: 'MiniTkl',
      },
    },
    keyRemap: {
      validPhysicalKeysForRemap: [
        {
          modifier: 'NonePressed',
          keys: [
            {
              physicalKeyId: 58,
              name: 'F1',
            },
            {
              physicalKeyId: 59,
              name: 'F2',
            },
            {
              physicalKeyId: 60,
              name: 'F3',
            },
            {
              physicalKeyId: 61,
              name: 'F4',
            },
            {
              physicalKeyId: 62,
              name: 'F5',
            },
            {
              physicalKeyId: 63,
              name: 'F6',
            },
            {
              physicalKeyId: 64,
              name: 'F7',
            },
            {
              physicalKeyId: 65,
              name: 'F8',
            },
            {
              physicalKeyId: 66,
              name: 'F9',
            },
            {
              physicalKeyId: 67,
              name: 'F10',
            },
            {
              physicalKeyId: 68,
              name: 'F11',
            },
            {
              physicalKeyId: 69,
              name: 'F12',
            },
            {
              physicalKeyId: 104,
              name: 'F13',
            },
            {
              physicalKeyId: 105,
              name: 'F14',
            },
            {
              physicalKeyId: 30,
              name: 'N1OrExclamation',
            },
            {
              physicalKeyId: 31,
              name: 'N2OrAt',
            },
            {
              physicalKeyId: 32,
              name: 'N3OrPound',
            },
            {
              physicalKeyId: 33,
              name: 'N4OrDollar',
            },
            {
              physicalKeyId: 34,
              name: 'N5OrPercent',
            },
            {
              physicalKeyId: 35,
              name: 'N6OrCaret',
            },
            {
              physicalKeyId: 36,
              name: 'N7OrAnd',
            },
            {
              physicalKeyId: 37,
              name: 'N8OrStar',
            },
            {
              physicalKeyId: 38,
              name: 'N9OrLeftParen',
            },
            {
              physicalKeyId: 39,
              name: 'N0OrRightParen',
            },
            {
              physicalKeyId: 4,
              name: 'A',
            },
            {
              physicalKeyId: 5,
              name: 'B',
            },
            {
              physicalKeyId: 6,
              name: 'C',
            },
            {
              physicalKeyId: 7,
              name: 'D',
            },
            {
              physicalKeyId: 8,
              name: 'E',
            },
            {
              physicalKeyId: 9,
              name: 'F',
            },
            {
              physicalKeyId: 10,
              name: 'G',
            },
            {
              physicalKeyId: 11,
              name: 'H',
            },
            {
              physicalKeyId: 12,
              name: 'I',
            },
            {
              physicalKeyId: 13,
              name: 'J',
            },
            {
              physicalKeyId: 14,
              name: 'K',
            },
            {
              physicalKeyId: 15,
              name: 'L',
            },
            {
              physicalKeyId: 16,
              name: 'M',
            },
            {
              physicalKeyId: 17,
              name: 'N',
            },
            {
              physicalKeyId: 18,
              name: 'O',
            },
            {
              physicalKeyId: 19,
              name: 'P',
            },
            {
              physicalKeyId: 20,
              name: 'Q',
            },
            {
              physicalKeyId: 21,
              name: 'R',
            },
            {
              physicalKeyId: 22,
              name: 'S',
            },
            {
              physicalKeyId: 23,
              name: 'T',
            },
            {
              physicalKeyId: 24,
              name: 'U',
            },
            {
              physicalKeyId: 25,
              name: 'V',
            },
            {
              physicalKeyId: 26,
              name: 'W',
            },
            {
              physicalKeyId: 27,
              name: 'X',
            },
            {
              physicalKeyId: 28,
              name: 'Y',
            },
            {
              physicalKeyId: 29,
              name: 'Z',
            },
            {
              physicalKeyId: 47,
              name: 'LeftSquareOrCurly',
            },
            {
              physicalKeyId: 48,
              name: 'RightSquareOrCurly',
            },
            {
              physicalKeyId: 226,
              name: 'LeftAlt',
            },
            {
              physicalKeyId: 230,
              name: 'RightAlt',
            },
            {
              physicalKeyId: 224,
              name: 'LeftControl',
            },
            {
              physicalKeyId: 228,
              name: 'RightControl',
            },
            {
              physicalKeyId: 225,
              name: 'LeftShift',
            },
            {
              physicalKeyId: 229,
              name: 'RightShift',
            },
            {
              physicalKeyId: 227,
              name: 'LeftGui',
            },
            {
              physicalKeyId: 231,
              name: 'RightGui',
            },
            {
              physicalKeyId: 80,
              name: 'LeftArrow',
            },
            {
              physicalKeyId: 79,
              name: 'RightArrow',
            },
            {
              physicalKeyId: 82,
              name: 'UpArrow',
            },
            {
              physicalKeyId: 81,
              name: 'DownArrow',
            },
            {
              physicalKeyId: 52,
              name: 'SingleOrDoubleQuote',
            },
            {
              physicalKeyId: 49,
              name: 'BackslashOrPipe',
            },
            {
              physicalKeyId: 42,
              name: 'BackspaceOrDelete',
            },
            {
              physicalKeyId: 57,
              name: 'CapsLock',
            },
            {
              physicalKeyId: 54,
              name: 'CommaOrLessThan',
            },
            {
              physicalKeyId: 76,
              name: 'DeleteForward',
            },
            {
              physicalKeyId: 77,
              name: 'End',
            },
            {
              physicalKeyId: 40,
              name: 'ReturnOrEnter',
            },
            {
              physicalKeyId: 46,
              name: 'EqualsOrPlus',
            },
            {
              physicalKeyId: 74,
              name: 'Home',
            },
            {
              physicalKeyId: 73,
              name: 'Insert',
            },
            {
              physicalKeyId: 45,
              name: 'MinusOrUnderscore',
            },
            {
              physicalKeyId: 78,
              name: 'PageDown',
            },
            {
              physicalKeyId: 75,
              name: 'PageUp',
            },
            {
              physicalKeyId: 72,
              name: 'Pause',
            },
            {
              physicalKeyId: 55,
              name: 'PeriodOrGreaterThan',
            },
            {
              physicalKeyId: 70,
              name: 'PrintScreen',
            },
            {
              physicalKeyId: 71,
              name: 'ScrollLock',
            },
            {
              physicalKeyId: 51,
              name: 'SemiColonOrColon',
            },
            {
              physicalKeyId: 56,
              name: 'ForwardSlashOrQuestionMark',
            },
            {
              physicalKeyId: 44,
              name: 'Spacebar',
            },
            {
              physicalKeyId: 43,
              name: 'Tab',
            },
            {
              physicalKeyId: 53,
              name: 'GraveAccentOrTilde',
            },
          ],
        },
        {
          modifier: 'Fn',
          keys: [
            {
              physicalKeyId: 63,
              name: 'F6',
            },
            {
              physicalKeyId: 64,
              name: 'F7',
            },
            {
              physicalKeyId: 65,
              name: 'F8',
            },
            {
              physicalKeyId: 104,
              name: 'F13',
            },
            {
              physicalKeyId: 105,
              name: 'F14',
            },
            {
              physicalKeyId: 30,
              name: 'N1OrExclamation',
            },
            {
              physicalKeyId: 31,
              name: 'N2OrAt',
            },
            {
              physicalKeyId: 32,
              name: 'N3OrPound',
            },
            {
              physicalKeyId: 33,
              name: 'N4OrDollar',
            },
            {
              physicalKeyId: 34,
              name: 'N5OrPercent',
            },
            {
              physicalKeyId: 35,
              name: 'N6OrCaret',
            },
            {
              physicalKeyId: 36,
              name: 'N7OrAnd',
            },
            {
              physicalKeyId: 37,
              name: 'N8OrStar',
            },
            {
              physicalKeyId: 38,
              name: 'N9OrLeftParen',
            },
            {
              physicalKeyId: 39,
              name: 'N0OrRightParen',
            },
            {
              physicalKeyId: 4,
              name: 'A',
            },
            {
              physicalKeyId: 5,
              name: 'B',
            },
            {
              physicalKeyId: 6,
              name: 'C',
            },
            {
              physicalKeyId: 7,
              name: 'D',
            },
            {
              physicalKeyId: 8,
              name: 'E',
            },
            {
              physicalKeyId: 9,
              name: 'F',
            },
            {
              physicalKeyId: 10,
              name: 'G',
            },
            {
              physicalKeyId: 11,
              name: 'H',
            },
            {
              physicalKeyId: 12,
              name: 'I',
            },
            {
              physicalKeyId: 13,
              name: 'J',
            },
            {
              physicalKeyId: 14,
              name: 'K',
            },
            {
              physicalKeyId: 15,
              name: 'L',
            },
            {
              physicalKeyId: 16,
              name: 'M',
            },
            {
              physicalKeyId: 17,
              name: 'N',
            },
            {
              physicalKeyId: 18,
              name: 'O',
            },
            {
              physicalKeyId: 19,
              name: 'P',
            },
            {
              physicalKeyId: 20,
              name: 'Q',
            },
            {
              physicalKeyId: 21,
              name: 'R',
            },
            {
              physicalKeyId: 22,
              name: 'S',
            },
            {
              physicalKeyId: 23,
              name: 'T',
            },
            {
              physicalKeyId: 24,
              name: 'U',
            },
            {
              physicalKeyId: 25,
              name: 'V',
            },
            {
              physicalKeyId: 26,
              name: 'W',
            },
            {
              physicalKeyId: 27,
              name: 'X',
            },
            {
              physicalKeyId: 28,
              name: 'Y',
            },
            {
              physicalKeyId: 29,
              name: 'Z',
            },
            {
              physicalKeyId: 47,
              name: 'LeftSquareOrCurly',
            },
            {
              physicalKeyId: 48,
              name: 'RightSquareOrCurly',
            },
            {
              physicalKeyId: 226,
              name: 'LeftAlt',
            },
            {
              physicalKeyId: 230,
              name: 'RightAlt',
            },
            {
              physicalKeyId: 224,
              name: 'LeftControl',
            },
            {
              physicalKeyId: 228,
              name: 'RightControl',
            },
            {
              physicalKeyId: 225,
              name: 'LeftShift',
            },
            {
              physicalKeyId: 229,
              name: 'RightShift',
            },
            {
              physicalKeyId: 227,
              name: 'LeftGui',
            },
            {
              physicalKeyId: 231,
              name: 'RightGui',
            },
            {
              physicalKeyId: 80,
              name: 'LeftArrow',
            },
            {
              physicalKeyId: 79,
              name: 'RightArrow',
            },
            {
              physicalKeyId: 82,
              name: 'UpArrow',
            },
            {
              physicalKeyId: 81,
              name: 'DownArrow',
            },
            {
              physicalKeyId: 52,
              name: 'SingleOrDoubleQuote',
            },
            {
              physicalKeyId: 49,
              name: 'BackslashOrPipe',
            },
            {
              physicalKeyId: 42,
              name: 'BackspaceOrDelete',
            },
            {
              physicalKeyId: 57,
              name: 'CapsLock',
            },
            {
              physicalKeyId: 54,
              name: 'CommaOrLessThan',
            },
            {
              physicalKeyId: 76,
              name: 'DeleteForward',
            },
            {
              physicalKeyId: 77,
              name: 'End',
            },
            {
              physicalKeyId: 40,
              name: 'ReturnOrEnter',
            },
            {
              physicalKeyId: 46,
              name: 'EqualsOrPlus',
            },
            {
              physicalKeyId: 74,
              name: 'Home',
            },
            {
              physicalKeyId: 73,
              name: 'Insert',
            },
            {
              physicalKeyId: 45,
              name: 'MinusOrUnderscore',
            },
            {
              physicalKeyId: 78,
              name: 'PageDown',
            },
            {
              physicalKeyId: 75,
              name: 'PageUp',
            },
            {
              physicalKeyId: 55,
              name: 'PeriodOrGreaterThan',
            },
            {
              physicalKeyId: 51,
              name: 'SemiColonOrColon',
            },
            {
              physicalKeyId: 56,
              name: 'ForwardSlashOrQuestionMark',
            },
            {
              physicalKeyId: 44,
              name: 'Spacebar',
            },
            {
              physicalKeyId: 43,
              name: 'Tab',
            },
            {
              physicalKeyId: 53,
              name: 'GraveAccentOrTilde',
            },
          ],
        },
      ],
      validSimpleRemapTargetKeys: {
        supportsHid: false,
        supportsMedia: true,
        custom: [
          {
            category: 'Remap Keys',
            keys: [
              {
                targetKeyId: 30,
              },
              {
                targetKeyId: 31,
              },
              {
                targetKeyId: 32,
              },
              {
                targetKeyId: 33,
              },
              {
                targetKeyId: 34,
              },
              {
                targetKeyId: 35,
              },
              {
                targetKeyId: 36,
              },
              {
                targetKeyId: 37,
              },
              {
                targetKeyId: 38,
              },
              {
                targetKeyId: 39,
              },
              {
                targetKeyId: 4,
              },
              {
                targetKeyId: 5,
              },
              {
                targetKeyId: 6,
              },
              {
                targetKeyId: 7,
              },
              {
                targetKeyId: 8,
              },
              {
                targetKeyId: 9,
              },
              {
                targetKeyId: 10,
              },
              {
                targetKeyId: 11,
              },
              {
                targetKeyId: 12,
              },
              {
                targetKeyId: 13,
              },
              {
                targetKeyId: 14,
              },
              {
                targetKeyId: 15,
              },
              {
                targetKeyId: 16,
              },
              {
                targetKeyId: 17,
              },
              {
                targetKeyId: 18,
              },
              {
                targetKeyId: 19,
              },
              {
                targetKeyId: 20,
              },
              {
                targetKeyId: 21,
              },
              {
                targetKeyId: 22,
              },
              {
                targetKeyId: 23,
              },
              {
                targetKeyId: 24,
              },
              {
                targetKeyId: 25,
              },
              {
                targetKeyId: 26,
              },
              {
                targetKeyId: 27,
              },
              {
                targetKeyId: 28,
              },
              {
                targetKeyId: 29,
              },
              {
                targetKeyId: 47,
              },
              {
                targetKeyId: 48,
              },
              {
                targetKeyId: 226,
              },
              {
                targetKeyId: 230,
              },
              {
                targetKeyId: 224,
              },
              {
                targetKeyId: 228,
              },
              {
                targetKeyId: 225,
              },
              {
                targetKeyId: 229,
              },
              {
                targetKeyId: 227,
              },
              {
                targetKeyId: 80,
              },
              {
                targetKeyId: 79,
              },
              {
                targetKeyId: 82,
              },
              {
                targetKeyId: 81,
              },
              {
                targetKeyId: 52,
              },
              {
                targetKeyId: 49,
              },
              {
                targetKeyId: 42,
              },
              {
                targetKeyId: 54,
              },
              {
                targetKeyId: 76,
              },
              {
                targetKeyId: 77,
              },
              {
                targetKeyId: 40,
              },
              {
                targetKeyId: 46,
              },
              {
                targetKeyId: 74,
              },
              {
                targetKeyId: 73,
              },
              {
                targetKeyId: 45,
              },
              {
                targetKeyId: 78,
              },
              {
                targetKeyId: 75,
              },
              {
                targetKeyId: 72,
              },
              {
                targetKeyId: 55,
              },
              {
                targetKeyId: 51,
              },
              {
                targetKeyId: 56,
              },
              {
                targetKeyId: 44,
              },
              {
                targetKeyId: 43,
              },
              {
                targetKeyId: 53,
              },
              {
                targetKeyId: 70,
              },
              {
                targetKeyId: 71,
              },
              {
                targetKeyId: 58,
              },
              {
                targetKeyId: 59,
              },
              {
                targetKeyId: 60,
              },
              {
                targetKeyId: 61,
              },
              {
                targetKeyId: 62,
              },
              {
                targetKeyId: 63,
              },
              {
                targetKeyId: 64,
              },
              {
                targetKeyId: 65,
              },
              {
                targetKeyId: 66,
              },
              {
                targetKeyId: 67,
              },
              {
                targetKeyId: 68,
              },
              {
                targetKeyId: 69,
              },
              {
                targetKeyId: 104,
              },
              {
                targetKeyId: 105,
              },
              {
                targetKeyId: 4278190319,
              },
            ],
          },
        ],
      },
      validMacroTargetKeys: {
        supportsHid: false,
        supportsMedia: false,
        custom: [
          {
            category: 'Macro Keys',
            keys: [
              {
                targetKeyId: 30,
              },
              {
                targetKeyId: 31,
              },
              {
                targetKeyId: 32,
              },
              {
                targetKeyId: 33,
              },
              {
                targetKeyId: 34,
              },
              {
                targetKeyId: 35,
              },
              {
                targetKeyId: 36,
              },
              {
                targetKeyId: 37,
              },
              {
                targetKeyId: 38,
              },
              {
                targetKeyId: 39,
              },
              {
                targetKeyId: 4,
              },
              {
                targetKeyId: 5,
              },
              {
                targetKeyId: 6,
              },
              {
                targetKeyId: 7,
              },
              {
                targetKeyId: 8,
              },
              {
                targetKeyId: 9,
              },
              {
                targetKeyId: 10,
              },
              {
                targetKeyId: 11,
              },
              {
                targetKeyId: 12,
              },
              {
                targetKeyId: 13,
              },
              {
                targetKeyId: 14,
              },
              {
                targetKeyId: 15,
              },
              {
                targetKeyId: 16,
              },
              {
                targetKeyId: 17,
              },
              {
                targetKeyId: 18,
              },
              {
                targetKeyId: 19,
              },
              {
                targetKeyId: 20,
              },
              {
                targetKeyId: 21,
              },
              {
                targetKeyId: 22,
              },
              {
                targetKeyId: 23,
              },
              {
                targetKeyId: 24,
              },
              {
                targetKeyId: 25,
              },
              {
                targetKeyId: 26,
              },
              {
                targetKeyId: 27,
              },
              {
                targetKeyId: 28,
              },
              {
                targetKeyId: 29,
              },
              {
                targetKeyId: 47,
              },
              {
                targetKeyId: 48,
              },
              {
                targetKeyId: 226,
              },
              {
                targetKeyId: 230,
              },
              {
                targetKeyId: 224,
              },
              {
                targetKeyId: 228,
              },
              {
                targetKeyId: 225,
              },
              {
                targetKeyId: 229,
              },
              {
                targetKeyId: 227,
              },
              {
                targetKeyId: 80,
              },
              {
                targetKeyId: 79,
              },
              {
                targetKeyId: 82,
              },
              {
                targetKeyId: 81,
              },
              {
                targetKeyId: 52,
              },
              {
                targetKeyId: 49,
              },
              {
                targetKeyId: 42,
              },
              {
                targetKeyId: 54,
              },
              {
                targetKeyId: 76,
              },
              {
                targetKeyId: 77,
              },
              {
                targetKeyId: 40,
              },
              {
                targetKeyId: 46,
              },
              {
                targetKeyId: 74,
              },
              {
                targetKeyId: 73,
              },
              {
                targetKeyId: 45,
              },
              {
                targetKeyId: 78,
              },
              {
                targetKeyId: 75,
              },
              {
                targetKeyId: 72,
              },
              {
                targetKeyId: 55,
              },
              {
                targetKeyId: 51,
              },
              {
                targetKeyId: 56,
              },
              {
                targetKeyId: 44,
              },
              {
                targetKeyId: 43,
              },
              {
                targetKeyId: 53,
              },
              {
                targetKeyId: 104,
              },
              {
                targetKeyId: 105,
              },
            ],
          },
        ],
      },
      validMacroActionTargetKeyTimeoutRange: {
        minSeconds: 0.02,
        maxSeconds: 1,
        stepSeconds: 0.001,
      },
      validRepeatCountRange: {
        min: 1,
        max: 254,
      },
      validActuationTypes: [
        {
          validLevels: [
            {
              valueMicroMeters: 600,
            },
            {
              valueMicroMeters: 700,
            },
            {
              valueMicroMeters: 800,
            },
            {
              valueMicroMeters: 900,
            },
            {
              valueMicroMeters: 1000,
            },
            {
              valueMicroMeters: 1100,
            },
            {
              valueMicroMeters: 1200,
            },
            {
              valueMicroMeters: 1280,
            },
            {
              valueMicroMeters: 1360,
            },
            {
              valueMicroMeters: 1440,
            },
            {
              valueMicroMeters: 1520,
            },
            {
              valueMicroMeters: 1600,
            },
            {
              valueMicroMeters: 1680,
            },
            {
              valueMicroMeters: 1760,
            },
            {
              valueMicroMeters: 1840,
            },
            {
              valueMicroMeters: 1920,
            },
            {
              valueMicroMeters: 2000,
            },
            {
              valueMicroMeters: 2080,
            },
            {
              valueMicroMeters: 2160,
            },
            {
              valueMicroMeters: 2240,
            },
            {
              valueMicroMeters: 2320,
            },
            {
              valueMicroMeters: 2400,
            },
            {
              valueMicroMeters: 2480,
            },
            {
              valueMicroMeters: 2560,
            },
            {
              valueMicroMeters: 2640,
            },
            {
              valueMicroMeters: 2720,
            },
            {
              valueMicroMeters: 2800,
            },
            {
              valueMicroMeters: 2880,
            },
            {
              valueMicroMeters: 3000,
            },
            {
              valueMicroMeters: 3140,
            },
            {
              valueMicroMeters: 3220,
            },
            {
              valueMicroMeters: 3300,
            },
            {
              valueMicroMeters: 3380,
            },
            {
              valueMicroMeters: 3460,
            },
            {
              valueMicroMeters: 3540,
            },
            {
              valueMicroMeters: 3620,
            },
            {
              valueMicroMeters: 3700,
            },
            {
              valueMicroMeters: 3780,
            },
            {
              valueMicroMeters: 3860,
            },
            {
              valueMicroMeters: 4000,
            },
          ],
          kind: 'Single',
        },
        {
          validLevels: [
            {
              valueMicroMeters: 600,
            },
            {
              valueMicroMeters: 700,
            },
            {
              valueMicroMeters: 800,
            },
            {
              valueMicroMeters: 900,
            },
            {
              valueMicroMeters: 1000,
            },
            {
              valueMicroMeters: 1100,
            },
            {
              valueMicroMeters: 1200,
            },
            {
              valueMicroMeters: 1280,
            },
            {
              valueMicroMeters: 1360,
            },
            {
              valueMicroMeters: 1440,
            },
            {
              valueMicroMeters: 1520,
            },
            {
              valueMicroMeters: 1600,
            },
            {
              valueMicroMeters: 1680,
            },
            {
              valueMicroMeters: 1760,
            },
            {
              valueMicroMeters: 1840,
            },
            {
              valueMicroMeters: 1920,
            },
            {
              valueMicroMeters: 2000,
            },
            {
              valueMicroMeters: 2080,
            },
            {
              valueMicroMeters: 2160,
            },
            {
              valueMicroMeters: 2240,
            },
            {
              valueMicroMeters: 2320,
            },
            {
              valueMicroMeters: 2400,
            },
            {
              valueMicroMeters: 2480,
            },
            {
              valueMicroMeters: 2560,
            },
            {
              valueMicroMeters: 2640,
            },
            {
              valueMicroMeters: 2720,
            },
            {
              valueMicroMeters: 2800,
            },
            {
              valueMicroMeters: 2880,
            },
            {
              valueMicroMeters: 3000,
            },
            {
              valueMicroMeters: 3140,
            },
            {
              valueMicroMeters: 3220,
            },
            {
              valueMicroMeters: 3300,
            },
            {
              valueMicroMeters: 3380,
            },
            {
              valueMicroMeters: 3460,
            },
            {
              valueMicroMeters: 3540,
            },
            {
              valueMicroMeters: 3620,
            },
            {
              valueMicroMeters: 3700,
            },
            {
              valueMicroMeters: 3780,
            },
            {
              valueMicroMeters: 3860,
            },
            {
              valueMicroMeters: 4000,
            },
          ],
          kind: 'Dual',
        },
        {
          validLevels: [
            {
              valueMicroMeters: 600,
            },
            {
              valueMicroMeters: 700,
            },
            {
              valueMicroMeters: 800,
            },
            {
              valueMicroMeters: 900,
            },
            {
              valueMicroMeters: 1000,
            },
            {
              valueMicroMeters: 1100,
            },
            {
              valueMicroMeters: 1200,
            },
            {
              valueMicroMeters: 1280,
            },
            {
              valueMicroMeters: 1360,
            },
            {
              valueMicroMeters: 1440,
            },
            {
              valueMicroMeters: 1520,
            },
            {
              valueMicroMeters: 1600,
            },
            {
              valueMicroMeters: 1680,
            },
            {
              valueMicroMeters: 1760,
            },
            {
              valueMicroMeters: 1840,
            },
            {
              valueMicroMeters: 1920,
            },
            {
              valueMicroMeters: 2000,
            },
            {
              valueMicroMeters: 2080,
            },
            {
              valueMicroMeters: 2160,
            },
            {
              valueMicroMeters: 2240,
            },
            {
              valueMicroMeters: 2320,
            },
            {
              valueMicroMeters: 2400,
            },
            {
              valueMicroMeters: 2480,
            },
            {
              valueMicroMeters: 2560,
            },
            {
              valueMicroMeters: 2640,
            },
            {
              valueMicroMeters: 2720,
            },
            {
              valueMicroMeters: 2800,
            },
            {
              valueMicroMeters: 2880,
            },
            {
              valueMicroMeters: 3000,
            },
            {
              valueMicroMeters: 3140,
            },
            {
              valueMicroMeters: 3220,
            },
            {
              valueMicroMeters: 3300,
            },
            {
              valueMicroMeters: 3380,
            },
            {
              valueMicroMeters: 3460,
            },
            {
              valueMicroMeters: 3540,
            },
            {
              valueMicroMeters: 3620,
            },
            {
              valueMicroMeters: 3700,
            },
            {
              valueMicroMeters: 3780,
            },
            {
              valueMicroMeters: 3860,
            },
            {
              valueMicroMeters: 4000,
            },
          ],
          validSensitivity: [
            {
              valueMicroMeters: 80,
            },
            {
              valueMicroMeters: 160,
            },
            {
              valueMicroMeters: 240,
            },
            {
              valueMicroMeters: 320,
            },
            {
              valueMicroMeters: 400,
            },
            {
              valueMicroMeters: 480,
            },
            {
              valueMicroMeters: 560,
            },
            {
              valueMicroMeters: 640,
            },
            {
              valueMicroMeters: 720,
            },
            {
              valueMicroMeters: 800,
            },
            {
              valueMicroMeters: 880,
            },
            {
              valueMicroMeters: 960,
            },
            {
              valueMicroMeters: 1040,
            },
            {
              valueMicroMeters: 1120,
            },
            {
              valueMicroMeters: 1200,
            },
            {
              valueMicroMeters: 1280,
            },
            {
              valueMicroMeters: 1360,
            },
            {
              valueMicroMeters: 1440,
            },
            {
              valueMicroMeters: 1520,
            },
            {
              valueMicroMeters: 1600,
            },
            {
              valueMicroMeters: 1680,
            },
            {
              valueMicroMeters: 1760,
            },
            {
              valueMicroMeters: 1840,
            },
            {
              valueMicroMeters: 1920,
            },
            {
              valueMicroMeters: 2000,
            },
            {
              valueMicroMeters: 2080,
            },
            {
              valueMicroMeters: 2160,
            },
            {
              valueMicroMeters: 2240,
            },
            {
              valueMicroMeters: 2320,
            },
            {
              valueMicroMeters: 2400,
            },
            {
              valueMicroMeters: 2480,
            },
            {
              valueMicroMeters: 2560,
            },
            {
              valueMicroMeters: 2640,
            },
            {
              valueMicroMeters: 2720,
            },
            {
              valueMicroMeters: 2800,
            },
            {
              valueMicroMeters: 2880,
            },
            {
              valueMicroMeters: 2960,
            },
            {
              valueMicroMeters: 3040,
            },
            {
              valueMicroMeters: 3120,
            },
            {
              valueMicroMeters: 3200,
            },
          ],
          kind: 'Rapid',
        },
      ],
      maxSnapOverrideConfigs: 3,
    },
    pollingRate: {
      validValues: [
        'Hz8000',
        'Hz4000',
        'Hz2000',
        'Hz1000',
        'Hz500',
        'Hz250',
        'Hz125',
      ],
    },
    deviceSpecificData: {
      hardware_id: '1',
    },
    keyboardMouseLighting: {
      maxGradientCount: 10,
      supportedBaseEffects: [
        'Color',
        'SolidGradient2',
        'ShiftColor',
        'PulseColor',
        'Wave',
        'CoveringMarquee',
      ],
      supportedReactiveEffects: ['Fade', 'Ripple', 'Line'],
      supportedRingEffects: {
        effects: [
          'Color',
          'SolidGradient2',
          'ShiftColor',
          'PulseColor',
          'Wave',
          'CoveringMarquee',
        ],
        ledCount: 45,
      },
      maxNumberOfBaseEffects: 10,
      maxNumberOfReactiveEffects: 2,
    },
  },
};
