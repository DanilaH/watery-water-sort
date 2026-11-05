# Add project specific ProGuard rules here.
# Capacitor discovers plugin methods by annotation/reflection across the JS bridge.
# Keep our four plugin entry points, including their runtime annotations.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep @com.getcapacitor.annotation.CapacitorPlugin class com.danilah.waterywatersort.** extends com.getcapacitor.Plugin { *; }
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
