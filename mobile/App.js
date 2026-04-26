import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import LoginScreen       from './src/screens/LoginScreen';
import RegisterScreen    from './src/screens/RegisterScreen';
import DashboardScreen   from './src/screens/DashboardScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import ResultsScreen     from './src/screens/ResultsScreen';
import AboutScreen       from './src/screens/AboutScreen';
import WikiScreen        from './src/screens/WikiScreen';
import TechnologyScreen  from './src/screens/TechnologyScreen';
import ContactScreen     from './src/screens/ContactScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

const HEADER = {
  headerStyle:      { backgroundColor: 'rgba(3,7,18,0.97)' },
  headerTintColor:  colors.white,
  headerTitleStyle: { fontWeight: '700', color: colors.white },
  headerBackTitleVisible: false,
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: colors.bg },
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...HEADER, headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen}
        options={{ headerShown: true, title: 'Create Account', ...HEADER }} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="Dashboard"   component={DashboardScreen}
        options={{ title: 'RetinaX Pro', headerShown: false }} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen}
        options={{ title: 'Diagnostic Engine' }} />
      <Stack.Screen name="Results"     component={ResultsScreen}
        options={{ title: 'Assessment Report' }} />
      <Stack.Screen name="About"       component={AboutScreen}
        options={{ title: 'About RetinaX' }} />
      <Stack.Screen name="Wiki"        component={WikiScreen}
        options={{ title: 'Knowledge Base' }} />
      <Stack.Screen name="Technology"  component={TechnologyScreen}
        options={{ title: 'AI Technology' }} />
      <Stack.Screen name="Contact"     component={ContactScreen}
        options={{ title: 'Contact Us' }} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.sky} size="large" />
      </View>
    );
  }

  return user ? <AppStack /> : <AuthStack />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
