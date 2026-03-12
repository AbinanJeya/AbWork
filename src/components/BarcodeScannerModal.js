import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export function BarcodeScannerModal({ visible, onClose, onScan }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible) {
            setScanned(false);
            if (!permission?.granted) {
                requestPermission();
            }
        }
    }, [visible, permission]);

    const handleBarcodeScanned = ({ type, data }) => {
        if (!scanned) {
            setScanned(true);
            onScan(data);
            onClose();
        }
    };

    if (!visible) return null;

    if (!permission) {
        return (
            <Modal visible={visible} animationType="slide">
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#4ade80" />
                </View>
            </Modal>
        );
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="slide">
                <View style={[styles.container, { padding: 20 }]}>
                    <Text style={{ textAlign: 'center', color: '#fff', fontSize: 18, marginBottom: 20 }}>
                        We need your permission to use the camera
                    </Text>
                    <TouchableOpacity style={styles.btn} onPress={requestPermission}>
                        <Text style={styles.btnText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#334155', marginTop: 10 }]} onPress={onClose}>
                        <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide">
            <View style={styles.container}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                    }}
                />
                <View style={styles.overlay}>
                    <View style={styles.scanBox} />
                    <Text style={styles.scanText}>Line up a barcode within the frame to scan</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scanBox: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#4ade80',
        backgroundColor: 'transparent',
    },
    scanText: {
        color: '#fff',
        marginTop: 20,
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_600SemiBold',
    },
    closeBtn: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: '#ef4444',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 24,
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    btn: {
        backgroundColor: '#4ade80',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
