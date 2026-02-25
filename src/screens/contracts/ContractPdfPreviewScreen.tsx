import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScreenHeader } from '../../components/ScreenHeader';

interface ContractPdfPreviewScreenProps {
  route: {
    params: {
      url_pdf: string;
    };
  };
  navigation: any;
}

export const ContractPdfPreviewScreen: React.FC<ContractPdfPreviewScreenProps> = ({
  route,
  navigation,
}) => {
  const { url_pdf } = route.params;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Aperçu du contrat" onBack={() => navigation.goBack()} />
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: url_pdf }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webviewContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  webview: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});

