import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './Icon';
import { colors, radius } from '../theme';

type Props = {
  icon: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={48} color="#C7C1D4" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 64, paddingHorizontal: 30, alignItems: 'center' },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 18, fontSize: 20, fontWeight: '800', color: colors.text },
  body: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: 22,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
