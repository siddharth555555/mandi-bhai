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
import { verifyOtp } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export default function OtpScreen({ route, navigation }: Props) {
  const { phone, devOtp } = route.params;
  const { signIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    if (value.length !== 4 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await verifyOtp(phone, value);
      await signIn(token, user);
      // App.tsx's navigator switches on auth/profile state automatically —
      // no explicit navigation needed here.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={{ fontSize: 18 }}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>Enter the 4-digit code sent to +91 {phone}</Text>

      <TextInput
        style={styles.otpInput}
        keyboardType="number-pad"
        maxLength={4}
        autoFocus
        value={otp}
        onChangeText={(t) => {
          const digits = t.replace(/[^0-9]/g, '');
          setOtp(digits);
          if (digits.length === 4) submit(digits);
        }}
      />

      {/* Dev-only helper: backend SMS sending is stubbed (see TODO.md), so
          the OTP is returned directly in the request response. */}
      <TouchableOpacity onPress={() => submit(devOtp)} style={styles.autofill}>
        <Text style={styles.autofillText}>⚡ Autofill dev OTP ({devOtp})</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator style={{ marginTop: 16 }} color="#2456E6" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF7EF', padding: 24, paddingTop: 60 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F1ECE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 24, fontSize: 26, fontWeight: '800', color: '#191723' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#6B6577' },
  otpInput: {
    marginTop: 28,
    width: 160,
    height: 64,
    borderWidth: 2,
    borderColor: '#EDE7DA',
    borderRadius: 16,
    backgroundColor: '#fff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
  autofill: { marginTop: 18, alignSelf: 'flex-start' },
  autofillText: { color: '#2456E6', fontWeight: '800' },
  error: { marginTop: 14, color: '#E23B1E', fontWeight: '600' },
});
