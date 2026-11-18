import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';

/**
 * How far the bottom of a sheet has to rise to stay above the keyboard. `KeyboardAvoidingView` measures itself in the
 * sheet's own coordinates, so it lifts too little and the field ends up under the keys. A sheet always rests on the
 * bottom of the screen, so the part the keyboard covers is simply how far its top edge reaches up from there.
 */
export function useKeyboardLift(): number {
  const { height: screen } = useWindowDimensions();
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      setLift(Math.max(0, Math.round(screen - event.endCoordinates.screenY)));
    });
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setLift(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [screen]);

  return lift;
}
