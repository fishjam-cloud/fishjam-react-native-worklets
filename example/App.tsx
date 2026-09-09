import { attachCameraFrameCallback } from '@fishjam-cloud/react-native-worklets';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>@fishjam-cloud/react-native-worklets example</Text>
      <Text>
        {typeof attachCameraFrameCallback === 'function' ? 'attachCameraFrameCallback is linked' : 'not linked'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
