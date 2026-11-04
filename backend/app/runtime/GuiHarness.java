package labmate.host;

import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import javax.swing.*;
import javax.swing.text.JTextComponent;

/** Trusted host: declarative controls only, no model-authored test program. */
public final class GuiHarness {
    private static final AtomicReference<Throwable> fatal=new AtomicReference<>();
    private static BufferedWriter events;
    private static Path images;
    private static int testNumber;
    private static String decode(String value){return new String(Base64.getDecoder().decode(value),StandardCharsets.UTF_8);}
    private static String encode(String value){return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));}
    private static void emit(String... fields)throws IOException{
        events.write(String.join("\t",fields));events.newLine();events.flush();
    }
    private static <T> T edt(Callable<T> action)throws Exception{
        FutureTask<T> task=new FutureTask<>(action);EventQueue.invokeLater(task);
        return task.get(2,TimeUnit.SECONDS);
    }
    private static void walk(Component item,List<Component> result){
        if(!item.isShowing())return;
        result.add(item);
        if(item instanceof Container)for(Component child:((Container)item).getComponents())walk(child,result);
    }
    private static List<Component> components(){
        List<Component> result=new ArrayList<>();
        for(Window window:Window.getWindows())walk(window,result);
        return result;
    }
    private static String text(Component item){
        if(item instanceof JPasswordField)return "[password]";
        if(item instanceof JTextComponent)return ((JTextComponent)item).getText();
        if(item instanceof TextComponent)return ((TextComponent)item).getText();
        if(item instanceof AbstractButton)return ((AbstractButton)item).getText();
        if(item instanceof Button)return ((Button)item).getLabel();
        if(item instanceof JLabel)return ((JLabel)item).getText();
        if(item instanceof Label)return ((Label)item).getText();
        if(item instanceof JComboBox)return String.valueOf(((JComboBox<?>)item).getSelectedItem());
        if(item instanceof Choice)return ((Choice)item).getSelectedItem();
        return "";
    }
    private static String observed(){
        StringBuilder result=new StringBuilder();
        for(Component item:components()){
            String value=text(item);
            if(value!=null&&!value.isEmpty())result.append(value).append("\n");
            if(result.length()>8000)break;
        }
        return result.substring(0,Math.min(result.length(),8000));
    }
    private static boolean role(Component item,String role){
        if(role.equals("button"))return item instanceof AbstractButton||item instanceof Button;
        if(role.equals("textbox")||role.equals("spinbutton"))return item instanceof JTextComponent||item instanceof TextComponent;
        if(role.equals("combobox"))return item instanceof JComboBox||item instanceof Choice;
        if(role.equals("checkbox"))return item instanceof JCheckBox||item instanceof Checkbox;
        return item instanceof JLabel||item instanceof Label;
    }
    private static List<Component> locate(String[] step){
        List<Component> matches=new ArrayList<>();String kind=step[1],target=step[2],wantedRole=step[3];
        for(Component item:components()){
            boolean found=kind.equals("testid")?target.equals(item.getName()):
                kind.equals("text")?target.equals(text(item)):
                kind.equals("role")&&role(item,wantedRole)&&(target.equals(text(item))||item.getAccessibleContext()!=null&&target.equals(item.getAccessibleContext().getAccessibleName()));
            if(kind.equals("label")&&item instanceof JLabel&&target.equals(text(item))){
                Component field=((JLabel)item).getLabelFor();if(field!=null&&field.isShowing())matches.add(field);
            }else if(found)matches.add(item);
        }
        return matches;
    }
    private static boolean visibleText(String expected){
        for(Component item:components()){
            String value=text(item);if(value==null)continue;
            boolean matches=expected.matches("-?\\d+(?:\\.\\d+)?")?value.equals(expected):value.contains(expected);
            if(!matches||item.getWidth()<1||item.getHeight()<1)continue;
            // A truncated JLabel property is not proof the required text is visible.
            if(item instanceof JLabel&&!value.startsWith("<html")&&item.getFontMetrics(item.getFont()).stringWidth(value)>item.getWidth())continue;
            return true;
        }
        return false;
    }
    private static String observation(String[] step){
        if(step[0].equals("assert_visible")||step[0].equals("assert_absent"))return String.valueOf(visibleText(step[2]));
        List<Component> matches=locate(step);
        if(step[0].equals("assert_count"))return String.valueOf(matches.size());
        if(matches.size()!=1)return "[missing or ambiguous control]";
        Component item=matches.get(0);
        if(step[0].equals("assert_checked"))return String.valueOf(item instanceof AbstractButton?((AbstractButton)item).isSelected():item instanceof Checkbox&&((Checkbox)item).getState());
        return text(item);
    }
    private static boolean assertion(String[] step){
        String actual=observation(step);
        if(step[0].equals("assert_visible"))return actual.equals("true");
        if(step[0].equals("assert_absent"))return actual.equals("false");
        return actual.equals(step[4]);
    }
    private static void mutate(String[] step)throws Exception{
        List<Component> matches=locate(step);
        if(matches.size()!=1)throw new IllegalArgumentException("Control is missing or ambiguous: "+step[2]);
        Component item=matches.get(0);
        if(!item.isEnabled())throw new IllegalArgumentException("Control is disabled: "+step[2]);
        switch(step[0]){
            case "fill":
                if(item instanceof JTextComponent)((JTextComponent)item).setText(step[4]);
                else if(item instanceof TextComponent)((TextComponent)item).setText(step[4]);
                else throw new IllegalArgumentException("Fill needs a text control.");
                break;
            case "click":
                // Schedule the real handler so a modal dialog does not block the host.
                if(item instanceof AbstractButton)EventQueue.invokeLater(()->((AbstractButton)item).doClick(0));
                else if(item instanceof Button)EventQueue.invokeLater(()->item.dispatchEvent(new ActionEvent(item,ActionEvent.ACTION_PERFORMED,((Button)item).getActionCommand())));
                else if(item instanceof Checkbox) {
                    Checkbox box=(Checkbox)item;box.setState(!box.getState());box.dispatchEvent(new ItemEvent(box,ItemEvent.ITEM_STATE_CHANGED,box.getLabel(),box.getState()?ItemEvent.SELECTED:ItemEvent.DESELECTED));
                } else throw new IllegalArgumentException("Click needs a button or checkbox.");
                break;
            case "select":
                if(item instanceof JComboBox){JComboBox<?> box=(JComboBox<?>)item;boolean found=false;for(int i=0;i<box.getItemCount();i++)if(step[4].equals(String.valueOf(box.getItemAt(i)))){box.setSelectedIndex(i);found=true;break;}if(!found)throw new IllegalArgumentException("Option missing.");}
                else if(item instanceof Choice){Choice box=(Choice)item;boolean found=false;for(int i=0;i<box.getItemCount();i++)if(step[4].equals(box.getItem(i))){box.select(i);box.dispatchEvent(new ItemEvent(box,ItemEvent.ITEM_STATE_CHANGED,step[4],ItemEvent.SELECTED));found=true;break;}if(!found)throw new IllegalArgumentException("Option missing.");}
                else throw new IllegalArgumentException("Select needs a choice control.");
                break;
            default:throw new IllegalArgumentException("Unsupported GUI action.");
        }
    }
    private static void settle()throws Exception{
        Thread.sleep(100);
        edt(()->{for(Window w:Window.getWindows())if(w.isShowing())w.validate();return null;});
        if(fatal.get()!=null)throw new IllegalStateException("Application error",fatal.get());
    }
    private static void screenshot(int step)throws Exception{
        edt(()->{
            Window chosen=null;
            for(Window w:Window.getWindows())if(w.isShowing()&&(chosen==null||w instanceof Dialog))chosen=w;
            if(chosen==null)throw new IllegalStateException("No visible application window.");
            Component content=chosen instanceof RootPaneContainer?((RootPaneContainer)chosen).getRootPane():chosen;
            int width=content.getWidth(),height=content.getHeight();
            if(width<160||height<80||width>1920||height>1600)throw new IllegalArgumentException("GUI dimensions must be between 160x80 and 1920x1600.");
            BufferedImage image=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);Graphics2D graphics=image.createGraphics();
            graphics.setColor(content.getBackground());graphics.fillRect(0,0,width,height);content.printAll(graphics);graphics.dispose();
            if(!(chosen instanceof RootPaneContainer)){
                Insets border=chosen.getInsets();
                image=image.getSubimage(border.left,border.top,width-border.left-border.right,height-border.top-border.bottom);
            }
            Path file=images.resolve("test_"+testNumber+(step>0?"_step_"+step:step<0?"_initial":"")+".png");ImageIO.write(image,"png",file.toFile());
            emit("IMAGE",file.getFileName().toString());return null;
        });
    }
    public static void main(String[] args)throws Exception{
        images=Paths.get(args[2]);testNumber=Integer.parseInt(args[4]);Files.createDirectories(images);
        events=Files.newBufferedWriter(Paths.get(args[3]),StandardCharsets.UTF_8);
        Thread.setDefaultUncaughtExceptionHandler((t,e)->fatal.compareAndSet(null,e));
        List<String[]> steps=new ArrayList<>();
        for(String row:Files.readAllLines(Paths.get(args[1]),StandardCharsets.UTF_8)){
            String[] columns=row.split("\t",-1);for(int i=2;i<columns.length;i++)columns[i]=decode(columns[i]);steps.add(columns);
        }
        Thread app=new Thread(()->{try{java.lang.reflect.Method entry=Class.forName(args[0]).getDeclaredMethod("main",String[].class);entry.setAccessible(true);entry.invoke(null,(Object)new String[0]);}catch(Throwable e){fatal.compareAndSet(null,e);}},"student-main");app.setDaemon(true);app.start();
        boolean passed=true;int current=0;
        try{
            long startupMillis=Math.max(1000,Math.min(20000,Long.getLong("labmate.gui.startupMillis",15000)));
            long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(startupMillis);
            boolean ready=false;
            while(System.nanoTime()<deadline){if(edt(()->!components().isEmpty())){ready=true;break;}if(fatal.get()!=null)throw new IllegalStateException("Application startup failed",fatal.get());Thread.sleep(50);}
            if(!ready)throw new IllegalStateException("Application window did not become visible within "+startupMillis+"ms.",fatal.get());
            settle();screenshot(-1);
            List<String> initial=new ArrayList<>();for(String[] step:steps)initial.add(edt(()->observation(step)));
            for(int i=0;i<steps.size();i++){
                current=i+1;String[] step=steps.get(i);boolean check=step[0].startsWith("assert_");
                if(step[0].equals("screenshot")){screenshot(current);continue;}
                if(check){
                    long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);
                    while(!edt(()->assertion(step))&&System.nanoTime()<until)Thread.sleep(80);
                    boolean ok=edt(()->assertion(step));String actual=edt(()->observation(step));
                    emit("ASSERT",String.valueOf(current),step[0],ok?"passed":"failed",encode(step[2].isEmpty()?step[4]:step[2]),encode(actual),String.valueOf(!initial.get(i).equals(actual)));
                    if(!ok)throw new IllegalStateException("Expected visible GUI state was not observed: "+step[2]+" "+step[4]);
                }else{edt(()->{mutate(step);return null;});settle();}
            }
        }catch(Throwable failure){passed=false;emit("ERROR",String.valueOf(current),encode(failure.toString()));}
        try{screenshot(0);}catch(Throwable error){passed=false;emit("ERROR",String.valueOf(current),encode(error.toString()));}
        emit("OBSERVED",encode(edt(()->observed())));emit("DONE",passed?"passed":"failed");events.close();
        System.exit(passed?0:1);
    }
}
