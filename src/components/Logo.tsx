import { Image } from 'react-native';
import type { StyleProp, ImageStyle } from 'react-native';

interface LogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Icona dell'app (assets/images/icon.png) — badge circolare già a bordo intero sul canvas quadrato, `borderRadius: size/2` la ritaglia in un cerchio pulito quando mostrata piccola (sidebar/header), coerente con la forma del badge stesso. */
export function Logo({ size = 40, style }: LogoProps) {
  return (
    <Image
      source={require('../../assets/images/icon.png')}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  );
}
