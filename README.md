📢📢📢注意终端需要配置一下代理vpn

```
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
我用的clashX 不然eas build 一直上传失败
```



1. ```
   npx create-expo-app webRtc-Video-demo
   ```

2. ```json
   "react-native-video": "6.0.0-alpha.4",
   "react-native-webrtc": "111.0.3",
   "@config-plugins/react-native-webrtc": "7.0.0",
   ```

3. app.json

   ```json
   "plugins": [
         "@config-plugins/react-native-webrtc"
    ],
   ```

   

4. 实际上react-native-video 可以用expo-av 替代，播放流视频靠webrtcView

5. ```
   yarn
   ```

6. 转换成 云 开发版 [创建开发版本 - Expo Documentation --- Create a development build - Expo Documentation](https://docs.expo.dev/develop/development-builds/create-a-build/)

   ```
   npm install -g eas-cli
   npx expo install expo-dev-client
   eas login
   eas build (直接运行下面是不是也行。。。)
   eas build --profile development --platform android (我只能搞了Android ios 要apple付费账号（需要测试）,这个需要等一下时间，它会生成一个包含原生库的expo go的apk，相当于官方那个expo go应用的定制版吧。不太懂😁)
   ```

7. 顺利的话应该就好了，yarn start 启动项目扫描用安装的apk启动就好了。

8. 感觉好像对咱们现用的项目没有影响，但我也不太确定打包什么的，需要你在搂搂。。。。

9. demo 点content 在点start 就可以了（content 有点慢网问题，如果一直不行，那个key可能次数用完了。。。。）

   

