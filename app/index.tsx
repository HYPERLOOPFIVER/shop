import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !fullName || !phoneNumber) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }
    
    setLoading(true);
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Save additional user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email.toLowerCase(),
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        createdAt: new Date().toISOString(),
        profileCompleted: false, // Will be true after location selection
        isActive: true,
        locationSelected: false // Track if user has selected location
      });
      
      // Clear form
      setEmail("");
      setPassword("");
      setFullName("");
      setPhoneNumber("");
      
      // Navigate to location selection page using Expo Router
      router.push({
        pathname: "/home",
       
      });
      
    } catch (err) {
      let errorMessage = "An error occurred during signup";
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = "This email is already registered. Please use a different email or try logging in.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Please enter a valid email address.";
          break;
        case 'auth/weak-password':
          errorMessage = "Password is too weak. Please choose a stronger password.";
          break;
        default:
          errorMessage = err.message;
      }
      
      Alert.alert("Signup Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Clear form on successful login
      setEmail("");
      setPassword("");
      
      // Navigate to main app after successful login
      router.replace("/home"); // Assuming you have a tabs layout for main app
      
    } catch (err) {
      let errorMessage = "An error occurred during login";
      
      switch (err.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email. Please check your email or sign up.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password. Please try again.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Please enter a valid email address.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
        default:
          errorMessage = err.message;
      }
      
      Alert.alert("Login Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password screen
    router.push("/forgot-password");
  };

  const handleSocialLogin = (provider) => {
    // Handle social login based on provider
    console.log(`Social login with ${provider}`);
    // You can implement actual social login logic here
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="storefront" size={50} color="#fff" />
              </View>
              <Text style={styles.brandName}>LAKESMART</Text>
              <Text style={styles.tagline}>Your premium shopping destination</Text>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
              {/* Toggle Buttons */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, isLogin && styles.activeToggle]}
                  onPress={() => setIsLogin(true)}
                >
                  <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>
                    Login
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, !isLogin && styles.activeToggle]}
                  onPress={() => setIsLogin(false)}
                >
                  <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View style={styles.inputContainer}>
                {/* Name Field - Only for Signup */}
                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#999"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                )}

                {/* Phone Field - Only for Signup */}
                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor="#999"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                {/* Password strength indicator for signup */}
                {!isLogin && password.length > 0 && (
                  <View style={styles.passwordStrength}>
                    <Text style={[
                      styles.passwordStrengthText,
                      password.length >= 6 ? styles.strongPassword : styles.weakPassword
                    ]}>
                      {password.length >= 6 ? "✓ Strong password" : "⚠ Password must be at least 6 characters"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Forgot Password */}
              {isLogin && (
                <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.actionButton, loading && styles.disabledButton]}
                onPress={isLogin ? handleLogin : handleSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {isLogin ? "Login" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Social Login */}
              <View style={styles.socialContainer}>
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.divider} />
                </View>

                <View style={styles.socialButtons}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('google')}
                  >
                    <Ionicons name="logo-google" size={24} color="#db4437" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('apple')}
                  >
                    <Ionicons name="logo-apple" size={24} color="#000" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('facebook')}
                  >
                    <Ionicons name="logo-facebook" size={24} color="#4267b2" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms */}
              <Text style={styles.termsText}>
                By {isLogin ? "logging in" : "signing up"}, you agree to our{" "}
                <Text 
                  style={styles.linkText}
                  onPress={() => router.push("/terms-of-service")}
                >
                  Terms of Service
                </Text> and{" "}
                <Text 
                  style={styles.linkText}
                  onPress={() => router.push("/privacy-policy")}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeToggle: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeToggleText: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  socialContainer: {
    marginBottom: 24,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 50,
    height: 50,
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#667eea',
    fontWeight: '500',
  },
  passwordStrength: {
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  strongPassword: {
    color: '#28a745',
  },
  weakPassword: {
    color: '#dc3545',
  },
});