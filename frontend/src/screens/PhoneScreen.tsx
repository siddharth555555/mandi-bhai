import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { requestOtp } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Phone'>;

export default function PhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = /^[0-9]{10}$/.test(phone);

  const submit = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { devOtp } = await requestOtp(phone);
      navigation.navigate('Otp', { phone, devOtp });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Mandi <Text style={{ color: '#FFB43D' }}>Bhai</Text>
      </Text>
      <Text style={styles.subtitle}>Enter your phone number to continue</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>+91</Text>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="98765 43210"
          placeholderTextColor="#B7B0C0"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !isValid && styles.buttonDisabled]}
        disabled={!isValid || loading}
        onPress={submit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF7EF', padding: 24, paddingTop: 100 },
  title: { fontSize: 30, fontWeight: '800', color: '#191723' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#6B6577', marginBottom: 28 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#EDE7DA',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  prefix: { fontWeight: '800', fontSize: 18, color: '#191723' },
  divider: { width: 1, height: 26, backgroundColor: '#E7E0D2', marginHorizontal: 10 },
  input: { flex: 1, fontWeight: '800', fontSize: 18, paddingVertical: 16, color: '#191723' },
  error: { color: '#E23B1E', marginTop: 12, fontWeight: '600' },
  button: {
    marginTop: 24,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FF5436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
